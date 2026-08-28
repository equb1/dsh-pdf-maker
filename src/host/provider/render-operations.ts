import { readFile } from 'node:fs/promises'
import { pdfError } from '../service/errors.ts'
import type {
  PdfScreenshotRequest,
  PdfScreenshotResult,
} from '../service/types.ts'

/**
 * Render selected PDF pages to PNG and return durable DSH image attachments.
 *
 * Current stage: the engine (pdfjs-dist + canvas) is not wired yet. This stub
 * keeps the tool boundary stable so the worktree/edit pipeline can be built and
 * reviewed first. The planned implementation renders in the bundled Gateway
 * subprocess and stores PNGs via the DSH attachment service (`ctx.attachments`).
 */
export async function renderScreenshot(
  _request: PdfScreenshotRequest,
  _draft: string,
  _signal: AbortSignal | undefined,
): Promise<PdfScreenshotResult> {
  void readFile
  throw pdfError(
    'PDF rendering is not implemented yet; PDF editing and worktrees are available',
    'RENDER_UNAVAILABLE',
  )
}
