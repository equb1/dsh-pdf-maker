import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import type { WorktreeReviewAction } from '../../shared/wire/actions.ts'
import type {
  WorktreeLifecycle,
  WorktreeState,
} from '../../shared/wire/state.ts'
import { pdfError } from '../service/errors.ts'
import type { WorktreeId } from '../service/identifiers.ts'

/** Hidden per-workspace storage for isolated PDF drafts. */
const DRAFT_ROOT = '.dsh-pdf-maker/worktrees'

/** Resolve the storage root for one workspace. */
export function draftRoot(workspace: string): string {
  return join(workspace, DRAFT_ROOT)
}

/** Create an isolated draft worktree by copying the trunk PDF. */
export async function createWorktree(
  workspace: string,
  file: string,
  name: string | undefined,
): Promise<WorktreeState> {
  const id = randomUUID().slice(0, 8) as WorktreeId
  const dir = worktreeDir(workspace, file, id)
  await mkdir(dir, { recursive: true })
  const source = await readFile(file)
  await writeFile(join(dir, basename(file)), source)
  const meta: WorktreeMeta = {
    name: name ?? `draft-${id}`,
    lifecycle: 'draft',
    createdAt: Date.now(),
  }
  await writeWorktreeMeta(worktreeRoot(workspace, file), id, meta)
  return {
    worktreeId: id,
    name: meta.name,
    lifecycle: meta.lifecycle,
    pageCount: await pageCountOf(source),
    createdAt: meta.createdAt,
    updatedAt: Date.now(),
  }
}

/** Draft copy path for one worktree. */
export function draftPath(
  workspace: string,
  file: string,
  id: WorktreeId,
): string {
  return join(worktreeDir(workspace, file, id), basename(file))
}

/** List every worktree for one file, newest first. */
export async function listWorktrees(
  workspace: string,
  file: string,
): Promise<WorktreeState[]> {
  const root = worktreeRoot(workspace, file)
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const states: WorktreeState[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const id = entry.name as WorktreeId
    const draft = draftPath(workspace, file, id)
    const stat = await import('node:fs/promises')
      .then(({ stat }) => stat(draft))
      .catch(() => null)
    if (stat === null) continue
    const meta = await readWorktreeMeta(root, id)
    states.push({
      worktreeId: id,
      name: meta.name,
      lifecycle: meta.lifecycle,
      pageCount: await pageCountOf(await readFile(draft)),
      createdAt: stat.birthtimeMs,
      updatedAt: stat.mtimeMs,
    })
  }
  return states.sort((a, b) => b.createdAt - a.createdAt)
}

/** Read the draft copy for one worktree or fail closed. */
export async function requireDraft(
  workspace: string,
  file: string,
  id: WorktreeId,
): Promise<string> {
  const draft = draftPath(workspace, file, id)
  const { stat } = await import('node:fs/promises')
  if ((await stat(draft).catch(() => null)) === null) {
    throw pdfError(`worktree ${id} does not exist`, 'WORKTREE_NOT_FOUND')
  }
  return draft
}

/** Apply a review transition to one worktree. */
export async function applyReviewAction(
  workspace: string,
  file: string,
  id: WorktreeId,
  action: WorktreeReviewAction,
): Promise<WorktreeState> {
  const draft = await requireDraft(workspace, file, id)
  const meta = await readWorktreeMeta(worktreeRoot(workspace, file), id)
  const lifecycle = transitionFrom(action, meta.lifecycle)
  if (action === 'merge') {
    const merged = await readFile(draft)
    await writeFile(file, merged)
    await writeWorktreeMeta(worktreeRoot(workspace, file), id, {
      ...meta,
      lifecycle: 'merged',
    })
  } else if (action === 'discard') {
    await rm(dirname(draft), { recursive: true, force: true })
    return {
      worktreeId: id,
      name: meta.name,
      lifecycle: 'discarded',
      pageCount: null,
      createdAt: meta.createdAt,
      updatedAt: Date.now(),
    }
  } else if (action === 'ready') {
    await writeWorktreeMeta(worktreeRoot(workspace, file), id, {
      ...meta,
      lifecycle: 'ready',
    })
  } else if (action === 'reopen') {
    await writeWorktreeMeta(worktreeRoot(workspace, file), id, {
      ...meta,
      lifecycle: 'draft',
    })
  }
  return {
    worktreeId: id,
    name: meta.name,
    lifecycle,
    pageCount: await pageCountOf(await readFile(draft)),
    createdAt: meta.createdAt,
    updatedAt: Date.now(),
  }
}

/** Page count of raw PDF bytes via pdf-lib. */
export async function pageCountOf(source: Uint8Array): Promise<number> {
  const document = await PDFDocument.load(source, { ignoreEncryption: true })
  return document.getPageCount()
}

export interface WorktreeMeta {
  readonly name: string
  readonly lifecycle: WorktreeLifecycle
  readonly createdAt: number
}

function transitionFrom(
  action: WorktreeReviewAction,
  current: WorktreeLifecycle,
): WorktreeLifecycle {
  switch (action) {
    case 'ready':
      return current === 'merged' || current === 'discarded' ? current : 'ready'
    case 'reopen':
      return current === 'merged' || current === 'discarded' ? current : 'draft'
    case 'merge':
      return 'merged'
    case 'discard':
      return 'discarded'
  }
}

async function readWorktreeMeta(
  root: string,
  id: WorktreeId,
): Promise<WorktreeMeta> {
  const { readFile } = await import('node:fs/promises')
  const raw = await readFile(join(root, id, 'meta.json'), 'utf8').catch(
    () => null,
  )
  const now = Date.now()
  if (raw === null) return { name: 'draft', lifecycle: 'draft', createdAt: now }
  try {
    const parsed = JSON.parse(raw) as Partial<WorktreeMeta>
    return {
      name: typeof parsed.name === 'string' ? parsed.name : 'draft',
      lifecycle: parsed.lifecycle ?? 'draft',
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : now,
    }
  } catch {
    return { name: 'draft', lifecycle: 'draft', createdAt: now }
  }
}

async function writeWorktreeMeta(
  root: string,
  id: WorktreeId,
  meta: WorktreeMeta,
): Promise<void> {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(root, id, 'meta.json'), JSON.stringify(meta))
}

function worktreeRoot(workspace: string, file: string): string {
  return join(draftRoot(workspace), slugOf(file))
}

function worktreeDir(workspace: string, file: string, id: WorktreeId): string {
  return join(worktreeRoot(workspace, file), id)
}

function slugOf(file: string): string {
  return basename(file).replace(/[^A-Za-z0-9._-]/g, '_')
}
