import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileState } from '../../shared/wire/state.ts'
import type { PdfPackageStatus } from '../../shared/wire/status.ts'

/** Error envelope returned by the Host browser API. */
interface ApiError {
  readonly message?: string
  readonly code?: string
}

/** Same-origin URL for the bundled pdfjs worker module. */
export function getPdfWorkerSrc(): string {
  return `${window.location.origin}/pdf-api/pdf.worker.mjs`
}

/** Fetch the current PDF bytes (trunk or draft) for client-side page rendering. */
export async function fetchPdfBytes(
  file: string,
  sessionId: SessionId,
  worktreeId?: string,
): Promise<ArrayBuffer> {
  const url = getPdfContentUrl(file, sessionId, worktreeId, 0)
  const response = await fetch(url)
  if (!response.ok) {
    let code: string | undefined
    try {
      const body = (await response.json()) as ApiError
      code = body.code
    } catch {
      // non-JSON error body
    }
    throw new PdfApiError(
      `PDF content HTTP ${String(response.status)}`,
      code,
      response.status,
    )
  }
  return response.arrayBuffer()
}

/** Structured Host failure retained for UI decisions that depend on the error code. */
export class PdfApiError extends Error {
  readonly code: string | undefined
  readonly status: number

  constructor(message: string, code: string | undefined, status: number) {
    super(message)
    this.name = 'PdfApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${window.location.origin}${path}`, init)
  const body = (await response.json()) as T | ApiError
  if (!response.ok) {
    const error = body as ApiError
    throw new PdfApiError(
      error.message ?? `PDF API HTTP ${String(response.status)}`,
      error.code,
      response.status,
    )
  }
  return body as T
}

/** Read package, Gateway, and engine availability. */
export function getPdfStatus(): Promise<PdfPackageStatus> {
  return request('/pdf-api/status')
}

/** Read one file's current state and worktrees. */
export function getFileState(
  file: string,
  sessionId: SessionId,
): Promise<FileState> {
  return request(
    `/pdf-api/state?file=${encodeURIComponent(file)}&sessionId=${encodeURIComponent(sessionId)}`,
  )
}

/**
 * Get the direct streaming URL for viewing a trunk or draft worktree PDF.
 *
 * The URL is deterministic for a given (file, session, worktree) triple. It
 * carries no timestamp by itself: callers pass an explicit `salt` only when the
 * underlying content actually changed (an edit or lifecycle action), so the
 * viewer iframe only reloads when the bytes really changed — not on every
 * render.
 */
export function getPdfContentUrl(
  file: string,
  sessionId: SessionId,
  worktreeId?: string,
  salt?: number,
): string {
  const base = `${window.location.origin}/pdf-api/content?file=${encodeURIComponent(file)}&sessionId=${encodeURIComponent(sessionId)}`
  const scoped = worktreeId !== undefined && worktreeId.length > 0
    ? `${base}&worktreeId=${encodeURIComponent(worktreeId)}`
    : base
  return typeof salt === 'number' && Number.isFinite(salt)
    ? `${scoped}&_v=${salt}`
    : scoped
}

/** Execute a review action on a draft worktree (ready, reopen, merge, discard). */
export function performWorktreeAction(
  file: string,
  sessionId: SessionId,
  worktreeId: string,
  action: 'ready' | 'reopen' | 'merge' | 'discard',
): Promise<unknown> {
  return request('/pdf-api/worktree-action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file, sessionId, worktreeId, action }),
  })
}

/** Apply manual structural edits (reorder, rotate, delete, watermark, page number, flatten) to a draft. */
export function applyManualEdits(
  file: string,
  sessionId: SessionId,
  worktreeId: string,
  edits: unknown[],
): Promise<unknown> {
  return request('/pdf-api/edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file, sessionId, worktreeId, edits }),
  })
}

/** A projected file was removed (or never successfully created) in the session workspace. */
export function isMissingPdfFile(error: unknown): boolean {
  return error instanceof PdfApiError && error.code === 'INVALID_FILE_PATH'
}

/**
 * Build the `reorder_pages` order that restores a two-column alternating layout
 * (left column pages 1..mid then right column mid+1..N, interleaved as
 * 1, mid+1, 2, mid+2, ...) back to natural reading order 1..N.
 *
 * Example: N=4 interleaved is [1,3,2,4]; the returned order [1,3,2,4] applied
 * via reorder_pages yields [1,2,3,4].
 */
export function buildAlternateMergeOrder(count: number): number[] {
  if (count <= 0) return []
  const mid = Math.ceil(count / 2)
  const left = Array.from({ length: mid }, (_, i) => i + 1) // 1..mid
  const right = Array.from({ length: count - mid }, (_, i) => mid + i + 1)
  const interleaved: number[] = []
  const max = Math.max(left.length, right.length)
  for (let i = 0; i < max; i += 1) {
    if (i < left.length && left[i] !== undefined)
      interleaved.push(left[i] as number)
    if (i < right.length && right[i] !== undefined)
      interleaved.push(right[i] as number)
  }
  // order[k] = 1-based index of page value (k+1) in the interleaved layout.
  const order: number[] = []
  for (let k = 1; k <= count; k += 1) {
    order.push(interleaved.indexOf(k) + 1)
  }
  return order
}

