import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '../service/pdf-service.ts'
import { editTool, exportTool } from './definitions/edit.ts'
import { ocrTool } from './definitions/ocr.ts'
import { screenshotTool } from './definitions/screenshot.ts'
import { newTool, statusTool, worktreeTool } from './definitions/worktree.ts'
import { withPdfErrorContent } from './presentation.ts'

export const inject = ['pdf', 'tools']
export const name = 'pdf-tools'

/** Register model-facing domain tools over `ctx.pdf`. */
export function apply(ctx: Context): void {
  const gatewayReadTimeoutMs = 15_000
  const operationTimeoutMs = 120_000
  ctx.tools.register(withPdfErrorContent(newTool(ctx, gatewayReadTimeoutMs)))
  ctx.tools.register(withPdfErrorContent(statusTool(ctx, gatewayReadTimeoutMs)))
  ctx.tools.register(
    withPdfErrorContent(worktreeTool(ctx, gatewayReadTimeoutMs)),
  )
  ctx.tools.register(withPdfErrorContent(editTool(ctx, operationTimeoutMs)))
  ctx.tools.register(withPdfErrorContent(exportTool(ctx, operationTimeoutMs)))
  ctx.tools.register(
    withPdfErrorContent(screenshotTool(ctx, operationTimeoutMs)),
  )
  ctx.tools.register(withPdfErrorContent(ocrTool(ctx, operationTimeoutMs)))

  ctx.on('tools/pre-execute', (exec, next) => {
    if (exec.name !== 'pdf_worktree' || !isRecord(exec.arguments)) return next()
    const action = exec.arguments.action
    if (action !== 'merge' && action !== 'discard') return next()
    return Promise.resolve({
      kind: 'ask',
      reason:
        action === 'merge'
          ? 'Merging publishes the selected PDF worktree onto the trunk file.'
          : 'Discarding permanently removes the selected PDF worktree changes.',
    })
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
