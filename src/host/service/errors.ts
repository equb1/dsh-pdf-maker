/** Stable domain error codes that cross the model tool and browser API boundary. */
export type PdfErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_FILE_PATH'
  | 'FILE_PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'SESSION_SCOPE_UNAVAILABLE'
  | 'SESSION_SCOPE_DENIED'
  | 'PDF_INVALID'
  | 'PDF_OPERATION_FAILED'
  | 'FONT_UNAVAILABLE'
  | 'WORKTREE_NOT_FOUND'
  | 'WORKTREE_CONFLICT'
  | 'RENDER_UNAVAILABLE'
  | 'NOT_IMPLEMENTED_YET'
  | 'INTERNAL_ERROR'

/** A stable PDF domain error with a machine-readable code. */
export class PdfError extends Error {
  readonly code: PdfErrorCode
  readonly name = 'PdfError' as const

  constructor(
    message: string,
    code: PdfErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.code = code
  }
}

/** Create a stable PDF domain error. */
export function pdfError(
  message: string,
  code: PdfErrorCode,
  options?: { cause?: unknown },
): PdfError {
  return new PdfError(message, code, options)
}
