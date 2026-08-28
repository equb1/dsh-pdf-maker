import { existsSync, readFileSync } from 'node:fs'
import * as fontkit from 'fontkit'
import type { PDFDocument, PDFFont } from 'pdf-lib'
import { pdfError } from '../service/errors.ts'

/**
 * System CJK font discovery + embedding.
 *
 * pdf-lib can only embed single-face SFNT fonts (it cannot select a face from a
 * TTC collection), so single-face fonts are preferred. TTC candidates are
 * handled best-effort by extracting the largest face and re-embedding.
 */

/** True when the text contains characters outside the WinAnsi (Latin-1) range. */
export function hasNonLatinText(text: string): boolean {
  for (const char of text) {
    const codePoint = char.codePointAt(0)
    if (codePoint !== undefined && codePoint > 0xff) return true
  }
  return false
}

/** Candidate system fonts, ordered by preference (single-face first). */
const CANDIDATES: readonly string[] = [
  // macOS (single-face, verified embeddable)
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  // Windows (single-face TTF)
  'C:/Windows/Fonts/msyh.ttf',
  'C:/Windows/Fonts/simhei.ttf',
  'C:/Windows/Fonts/kaiu.ttf',
  // Linux (single-face, older Android/Ubuntu fonts)
  '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
  // TTC collections (best-effort extraction)
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
]

let resolvedBytes: Buffer | null | undefined

/** Find the first usable CJK font, caching the result for the process. */
export function resolveCjkFontBytes(): Buffer | null {
  if (resolvedBytes !== undefined) return resolvedBytes
  for (const path of CANDIDATES) {
    if (!existsSync(path)) continue
    try {
      const bytes = readFileSync(path)
      if (bytes.subarray(0, 4).toString('ascii') === 'ttcf') {
        const extracted = extractLargestFace(path, bytes)
        if (extracted !== null) {
          resolvedBytes = extracted
          return extracted
        }
        continue
      }
      resolvedBytes = bytes
      return bytes
    } catch {}
  }
  resolvedBytes = null
  return null
}

/** Extract the largest plausible subfont from a TTC collection. */
function extractLargestFace(path: string, bytes: Buffer): Buffer | null {
  try {
    const opened = fontkit.openSync(path)
    if (!('fonts' in opened)) return null
    const offsets = opened.header.offsets
    let best: Buffer | null = null
    for (let index = 0; index < offsets.length; index += 1) {
      const start = offsets[index]
      const end = offsets[index + 1] ?? bytes.length
      const face = bytes.subarray(start, end)
      if (
        face.length > 1024 * 1024 &&
        (best === null || face.length > best.length)
      ) {
        best = face
      }
    }
    return best
  } catch {
    return null
  }
}

/** Fonts already embedded into one document, reused for later draws. */
const embedded = new WeakMap<PDFDocument, PDFFont>()

/** Embed a system CJK font into the document (subset), cached per document. */
export async function embedCjkFont(document: PDFDocument): Promise<PDFFont> {
  const cached = embedded.get(document)
  if (cached !== undefined) return cached
  const bytes = resolveCjkFontBytes()
  if (bytes === null) {
    throw pdfError(
      'no system CJK font was found for this text',
      'FONT_UNAVAILABLE',
    )
  }
  // fontkit ships no types; register the real module under pdf-lib's expected shape.
  document.registerFontkit(
    fontkit as unknown as Parameters<PDFDocument['registerFontkit']>[0],
  )
  const font = await document.embedFont(bytes, { subset: true })
  embedded.set(document, font)
  return font
}
