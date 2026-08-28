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

/** A projected file was removed (or never successfully created) in the session workspace. */
export function isMissingPdfFile(error: unknown): boolean {
  return error instanceof PdfApiError && error.code === 'INVALID_FILE_PATH'
}
