import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { worktreeId } from '../../service/identifiers.ts'
import { operationOutput, operationTitle } from '../presentation.ts'
import { existingToolFile } from '../workspace.ts'

/** Create the `pdf_ocr` tool definition. */
export function ocrTool(ctx: Context, timeoutMs: number) {
  return defineTool({
    name: 'pdf_ocr',
    description:
      'Run OCR (optical character recognition, Chinese-first) on selected pages of a PDF and return the recognized text. Uses tesseract.js (chi_sim) with local language data.',
    timeoutMs,
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Workspace-relative or absolute .pdf path.',
      },
      worktreeId: {
        type: 'string',
        description: 'Optional draft worktree to OCR instead of the trunk.',
      },
      pages: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Optional 1-based page numbers; defaults to all pages.',
      },
      lang: {
        type: 'string',
        description: 'Optional OCR language (default chi_sim for Chinese).',
      },
    },
    output: operationOutput,
    async execute(args, exec) {
      const target = await existingToolFile(exec, args.file)
      const result = await ctx.pdf.ocr(
        {
          workspace: target.workspace,
          file: target.path,
          ...(args.worktreeId === undefined
            ? {}
            : { worktreeId: worktreeId(args.worktreeId) }),
          ...(args.pages === undefined ? {} : { pages: args.pages }),
          ...(args.lang === undefined ? {} : { lang: args.lang }),
        },
        exec.signal,
      )
      return {
        ok: true,
        operation: 'ocr' as const,
        file: target.path,
        result,
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: operationTitle('ocr', args.file),
      kind: 'execute',
    }),
  })
}
