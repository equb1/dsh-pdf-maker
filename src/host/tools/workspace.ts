import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { pdfError } from '../service/errors.ts'
import {
  resolveNewPdfPath,
  resolvePdfPath,
  resolveWorkspacePath,
} from '../service/workspace.ts'

/** Resolve the calling agent's workspace or fail closed for detached calls. */
export function toolWorkspace(exec: ToolRunContext): string {
  const cwd = exec.agent?.session.header.cwd
  if (cwd === undefined || cwd.length === 0) {
    throw pdfError(
      'PDF tools require a calling agent with a workspace.',
      'SESSION_SCOPE_UNAVAILABLE',
    )
  }
  return cwd
}

/** Resolve an existing PDF file for one tool execution. */
export function existingToolFile(exec: ToolRunContext, file: string) {
  return resolvePdfPath(toolWorkspace(exec), file)
}

/** Resolve a new PDF target for one tool execution. */
export function newToolFile(exec: ToolRunContext, file: string) {
  return resolveNewPdfPath(toolWorkspace(exec), file)
}

/** Resolve a new non-PDF output for one tool execution. */
export function newToolPath(exec: ToolRunContext, path: string) {
  return resolveWorkspacePath(toolWorkspace(exec), path)
}
