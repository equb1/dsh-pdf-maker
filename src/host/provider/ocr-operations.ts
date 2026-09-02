import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pdfError } from '../service/errors.ts'
import type { PdfOcrRequest, PdfOcrResult } from '../service/types.ts'

// tesseract.js, pdfjs-dist and @napi-rs/canvas are CJS/native; load them via
// createRequire so ESM provider code can resolve them from node_modules.
const require = createRequire(import.meta.url)

// Resolve package paths defensively.
function requireTesseract() {
  try {
    return require('tesseract.js')
  } catch {
    throw pdfError(
      'tesseract.js is not available (OCR not installed)',
      'OCR_UNAVAILABLE',
    )
  }
}

function requirePdfjs() {
  try {
    return require('pdfjs-dist/legacy/build/pdf.mjs')
  } catch {
    try {
      return require('pdfjs-dist')
    } catch {
      throw pdfError('pdfjs-dist is not available', 'OCR_UNAVAILABLE')
    }
  }
}

function requireCanvas() {
  try {
    return require('@napi-rs/canvas')
  } catch {
    throw pdfError(
      '@napi-rs/canvas is not available (needed to render PDF pages for OCR)',
      'OCR_UNAVAILABLE',
    )
  }
}

/** Minimal shape of a tesseract.js worker we use. */
interface TesseractWorkerLike {
  recognize(
    input: unknown,
  ): Promise<{ data?: { text?: string; confidence?: number } }>
  terminate(): Promise<unknown>
}

interface TesseractCreateWorker {
  (
    lang: string,
    oem: number,
    options: { langPath: string; workerPath: string; corePath: string },
  ): Promise<TesseractWorkerLike>
}

/**
 * Run OCR (Chinese-first) on selected pages of a PDF draft.
 *
 * Pipeline: pdfjs renders each page to a canvas -> PNG buffer -> tesseract.js
 * (chi_sim) recognizes text. Language data and worker are loaded from local
 * assets/tessdata and the bundled worker, so OCR runs fully offline.
 */
export async function runOcr(
  request: PdfOcrRequest,
  draft: string,
): Promise<PdfOcrResult> {
  const pdfjs = requirePdfjs()
  const { createWorker } = requireTesseract() as {
    createWorker: TesseractCreateWorker
  }
  const { createCanvas } = requireCanvas()

  const lang = request.lang ?? 'chi_sim'
  // Resolve worker + core via require so they point at the real node_modules
  // even when bundled. Language data lives under the project's assets/tessdata;
  // the runtime cwd is the workspace root (== project root).
  const workerPath = require.resolve('tesseract.js/dist/worker.min.js')
  const corePath = resolve(dirname(require.resolve('tesseract.js-core')), '..')
  const langPath = resolve(process.cwd(), 'assets', 'tessdata')

  // Set pdfjs worker to the legacy build's worker to run in Node.
  const pdfWorkerPath = require.resolve(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
  )
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerPath

  const bytes = await readFile(draft)
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
  const pageCount = doc.numPages
  const pages = request.pages ?? Array.from({ length: pageCount }, (_, i) => i + 1)

  let worker: TesseractWorkerLike | null = null
  try {
    // createWorker signature: (lang, oem, options). OEM 1 = LSTM_ONLY.
    worker = await createWorker(lang, 1, { langPath, workerPath, corePath })

    const results: { page: number; text: string; confidence: number }[] = []
    for (const pageNum of pages) {
      if (pageNum < 1 || pageNum > pageCount) continue
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = createCanvas(viewport.width, viewport.height)
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      const png = canvas.toBuffer('image/png')
      const { data } = await worker.recognize(png)
      const text = (data?.text ?? '').trim()
      const confidence = typeof data?.confidence === 'number' ? data.confidence : 0
      results.push({ page: pageNum, text, confidence })
    }
    return { file: request.file, pages: results }
  } catch (err) {
    throw pdfError(
      err instanceof Error ? err.message : String(err),
      'PDF_OPERATION_FAILED',
      { cause: err },
    )
  } finally {
    if (worker !== null) {
      try {
        await worker.terminate()
      } catch {
        // ignore
      }
    }
    try {
      await doc.destroy()
    } catch {
      // ignore
    }
  }
}
