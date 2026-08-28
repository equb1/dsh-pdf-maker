import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { worktreeId } from '../../service/identifiers.ts'
import { operationOutput, operationTitle } from '../presentation.ts'
import { existingToolFile } from '../workspace.ts'

/** Create the `pdf_screenshot` tool definition. */
export function screenshotTool(ctx: Context, timeoutMs: number) {
  return defineTool({
    name: 'pdf_screenshot',
    description:
      'Render selected pages of a PDF (trunk or draft worktree) as PNG images so the model and user can review layout. Requires the render engine.',
    timeoutMs,
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Workspace-relative or absolute .pdf path.',
      },
      worktreeId: {
        type: 'string',
        description: 'Optional draft worktree to render instead of the trunk.',
      },
      pages: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Optional 1-based page numbers; defaults to all pages.',
      },
      scale: {
        type: 'number',
        description: 'Optional render scale; defaults to 2.',
      },
    },
    output: operationOutput,
    async execute(args, exec) {
      const target = await existingToolFile(exec, args.file)
      const result = await ctx.pdf.screenshot(
        {
          workspace: target.workspace,
          file: target.path,
          ...(args.worktreeId === undefined
            ? {}
            : { worktreeId: worktreeId(args.worktreeId) }),
          ...(args.pages === undefined ? {} : { pages: args.pages }),
          ...(args.scale === undefined ? {} : { scale: args.scale }),
        },
        exec.signal,
      )
      return {
        ok: true,
        operation: 'screenshot' as const,
        file: target.path,
        result,
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: operationTitle('screenshot', args.file),
      kind: 'execute',
    }),
  })
}
