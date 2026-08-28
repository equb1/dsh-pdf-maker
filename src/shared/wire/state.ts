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

/** Trunk plus every draft worktree for one PDF file. */
export type FileState = {
  readonly file: string
  readonly exists: boolean
  readonly pageCount: number | null
  readonly worktrees: WorktreeState[]
  readonly gatewayOrigin: string | null
}
