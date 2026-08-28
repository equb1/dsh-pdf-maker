import { isAbsolute, resolve } from 'node:path'
import { pdfError } from './errors.ts'
import type { PdfFilePath, WorkspacePath } from './identifiers.ts'

/** One file resolved against an authorized workspace. */
export interface ScopedPdfPath {
  readonly workspace: WorkspacePath
  readonly path: PdfFilePath
}

/**
 * Resolve a possibly relative PDF target inside the calling workspace.
 * Absolute paths are accepted only when they stay inside the workspace realpath.
 */
export async function resolvePdfPath(
  workspace: string,
  value: string,
): Promise<ScopedPdfPath> {
  const root = await realpathDir(workspace)
  const candidate = isAbsolute(value) ? value : resolve(workspace, value)
  if (!candidate.toLowerCase().endsWith('.pdf')) {
    throw pdfError('target must be a .pdf file', 'INVALID_FILE_PATH')
  }
  const normalized = await realpathParent(candidate)
  if (normalized === null) {
    throw pdfError('target does not exist', 'INVALID_FILE_PATH')
  }
  if (!isWithin(root, normalized)) {
    throw pdfError(
      'target is outside the session workspace',
      'FILE_PERMISSION_DENIED',
    )
  }
  return { workspace: root as WorkspacePath, path: candidate as PdfFilePath }
}

/** Resolve a new PDF output that may not exist yet. */
export async function resolveNewPdfPath(
  workspace: string,
  value: string,
): Promise<ScopedPdfPath> {
  const root = await realpathDir(workspace)
  const candidate = isAbsolute(value) ? value : resolve(workspace, value)
  if (!candidate.toLowerCase().endsWith('.pdf')) {
    throw pdfError('target must be a .pdf file', 'INVALID_FILE_PATH')
  }
  const parent = resolve(candidate, '..')
  if (!isWithin(root, parent)) {
    throw pdfError(
      'target is outside the session workspace',
      'FILE_PERMISSION_DENIED',
    )
  }
  return { workspace: root as WorkspacePath, path: candidate as PdfFilePath }
}

/** Resolve an existing non-PDF source or output path inside the workspace. */
export async function resolveWorkspacePath(
  workspace: string,
  value: string,
): Promise<ScopedPdfPath> {
  const root = await realpathDir(workspace)
  const candidate = isAbsolute(value) ? value : resolve(workspace, value)
  const normalized = await realpathParent(candidate)
  if (normalized === null) {
    throw pdfError('path does not exist', 'INVALID_FILE_PATH')
  }
  if (!isWithin(root, normalized)) {
    throw pdfError(
      'path is outside the session workspace',
      'FILE_PERMISSION_DENIED',
    )
  }
  return { workspace: root as WorkspacePath, path: candidate as PdfFilePath }
}

async function realpathDir(value: string): Promise<string> {
  try {
    return await import('node:fs/promises').then(({ realpath }) =>
      realpath(value),
    )
  } catch {
    throw pdfError(
      'workspace is not a real directory',
      'SESSION_SCOPE_UNAVAILABLE',
    )
  }
}

async function realpathParent(value: string): Promise<string | null> {
  try {
    return await import('node:fs/promises').then(({ realpath }) =>
      realpath(resolve(value, '..')),
    )
  } catch {
    return null
  }
}

function isWithin(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`)
}
