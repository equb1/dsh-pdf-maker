/** Branded identifiers crossing the PDF domain boundary. */

export interface Brand<T extends string> {
  readonly __brand: T
}

export type WorkspacePath = string & Brand<'WorkspacePath'>
export type PdfFilePath = string & Brand<'PdfFilePath'>
export type WorktreeId = string & Brand<'WorktreeId'>

/** Coerce a raw string into a branded worktree id. */
export function worktreeId(value: string): WorktreeId {
  if (value.length === 0 || value.length > 128) {
    throw new Error(
      'worktreeId must be a non-empty string no longer than 128 characters',
    )
  }
  return value as WorktreeId
}
