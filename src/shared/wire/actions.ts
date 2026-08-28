/** Worktree review lifecycle actions shared between Host and Client. */

/** User- or model-initiated worktree transition. */
export type WorktreeReviewAction = 'ready' | 'reopen' | 'merge' | 'discard'

/** Action reported by a worktree operation, including draft creation. */
export type WorktreeActionResultAction = 'create' | WorktreeReviewAction

/** Outcome of a worktree review action. */
export type WorktreeActionResult = {
  readonly worktreeId: string
  readonly action: WorktreeActionResultAction
  readonly lifecycle: 'draft' | 'ready' | 'merged' | 'discarded'
  readonly path: string
}
