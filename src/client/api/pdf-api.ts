import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileState } from '../../shared/wire/state.ts'
import type { PdfPackageStatus } from '../../shared/wire/status.ts'

/** Error envelope returned by the Host browser API. */
interface ApiError {
  readonly message?: string
  readonly code?: string
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

/** Get the direct streaming URL for viewing a trunk or draft worktree PDF. */
export function getPdfContentUrl(
  file: string,
  sessionId: SessionId,
  worktreeId?: string,
): string {
  const base = `${window.location.origin}/pdf-api/content?file=${encodeURIComponent(file)}&sessionId=${encodeURIComponent(sessionId)}`
  return worktreeId !== undefined && worktreeId.length > 0
    ? `${base}&worktreeId=${encodeURIComponent(worktreeId)}&_t=${Date.now()}`
    : `${base}&_t=${Date.now()}`
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

/** A projected file was removed (or never successfully created) in the session workspace. */
export function isMissingPdfFile(error: unknown): boolean {
  return error instanceof PdfApiError && error.code === 'INVALID_FILE_PATH'
}
