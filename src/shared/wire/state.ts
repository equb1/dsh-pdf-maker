/** File and worktree state projection shared with the browser client. */

/** Lifecycle of one isolated PDF draft. */
export type WorktreeLifecycle = 'draft' | 'ready' | 'merged' | 'discarded'

/** One isolated draft worktree for a PDF file. */
export type WorktreeState = {
  readonly worktreeId: string
  readonly name: string
  readonly lifecycle: WorktreeLifecycle
  readonly pageCount: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

/** One page's geometry. */
export type PdfPageInfo = {
  readonly page: number
  readonly width: number
  readonly height: number
}

/** One interactive form field's inspection metadata. */
export type PdfFormFieldInfo = {
  readonly name: string
  readonly type:
    | 'text'
    | 'button'
    | 'dropdown'
    | 'checkbox'
    | 'radio'
    | 'unknown'
  readonly page?: number
  readonly rect?: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly value?: string
  readonly readOnly?: boolean
}

/** Trunk plus every draft worktree for one PDF file. */
export type FileState = {
  readonly file: string
  readonly exists: boolean
  readonly pageCount: number | null
  readonly pages?: PdfPageInfo[]
  readonly formFields?: PdfFormFieldInfo[]
  readonly worktrees: WorktreeState[]
  readonly gatewayOrigin: string | null
}
