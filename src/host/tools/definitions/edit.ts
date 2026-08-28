import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { pdfError } from '../../service/errors.ts'
import { worktreeId } from '../../service/identifiers.ts'
import type { PdfEditCommand } from '../../service/types.ts'
import { operationOutput, operationTitle } from '../presentation.ts'
import { existingToolFile, newToolPath } from '../workspace.ts'

/** Create the `pdf_edit` tool definition. */
export function editTool(ctx: Context, timeoutMs: number) {
  return defineTool({
    name: 'pdf_edit',
    description:
      'Apply structured edits (form fill or text) to an isolated draft worktree of a PDF, then ready it for review. Never edits the trunk directly.',
    timeoutMs,
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Workspace-relative or absolute .pdf path.',
      },
      worktreeId: {
        type: 'string',
        required: true,
        description: 'Draft worktree id from pdf_worktree create.',
      },
      edits: {
        type: 'array',
        required: true,
        description: 'Structured edits to apply.',
        items: {
          type: 'object',
          required: true,
          additionalProperties: false,
          properties: {
            kind: { type: 'string', required: true, enum: ['form', 'text'] },
            page: {
              type: 'integer',
              required: true,
              description: '1-based page number.',
            },
            fieldName: {
              type: 'string',
              description: 'Form field name when kind is form.',
            },
            value: {
              type: 'string',
              description: 'Form field value when kind is form.',
            },
            x: {
              type: 'number',
              description: 'Text x position in PDF points when kind is text.',
            },
            y: {
              type: 'number',
              description:
                'Text baseline y position in PDF points when kind is text.',
            },
            text: {
              type: 'string',
              description: 'Text to draw when kind is text.',
            },
            size: { type: 'number', description: 'Optional font size.' },
            color: {
              type: 'string',
              description: 'Optional #rrggbb text color.',
            },
          },
        },
      },
    },
    output: operationOutput,
    async execute(args, exec) {
      const target = await existingToolFile(exec, args.file)
      const result = await ctx.pdf.edit(
        {
          workspace: target.workspace,
          file: target.path,
          worktreeId: worktreeId(args.worktreeId),
          edits: parseEditCommands(args.edits),
        },
        exec.signal,
      )
      return { ok: true, operation: 'edit' as const, file: target.path, result }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: operationTitle('edit', args.file),
      kind: 'execute',
    }),
  })
}

/** Create the `pdf_export` tool definition. */
export function exportTool(ctx: Context, timeoutMs: number) {
  return defineTool({
    name: 'pdf_export',
    description:
      'Export the trunk or a worktree copy of a PDF to an authorized output path in the workspace.',
    timeoutMs,
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Workspace-relative or absolute source .pdf path.',
      },
      output: {
        type: 'string',
        required: true,
        description: 'Workspace-relative or absolute output path.',
      },
      worktreeId: {
        type: 'string',
        description: 'Optional draft worktree to export instead of the trunk.',
      },
    },
    output: operationOutput,
    async execute(args, exec) {
      const target = await existingToolFile(exec, args.file)
      const output = await newToolPath(exec, args.output)
      const result = await ctx.pdf.exportPdf(
        {
          workspace: target.workspace,
          file: target.path,
          output: args.output,
          outputWorkspace: output.workspace,
          ...(args.worktreeId === undefined
            ? {}
            : { worktreeId: worktreeId(args.worktreeId) }),
        },
        exec.signal,
      )
      return {
        ok: true,
        operation: 'export' as const,
        file: target.path,
        result,
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: operationTitle('export', args.file),
      kind: 'execute',
    }),
  })
}

/** Validate loose model-supplied edit objects into strict structured commands. */
function parseEditCommands(values: readonly unknown[]): PdfEditCommand[] {
  return values.map((value) => {
    const record = value as Record<string, unknown>
    if (
      typeof record !== 'object' ||
      record === null ||
      Array.isArray(record)
    ) {
      throw pdfError('each edit must be an object', 'INVALID_REQUEST')
    }
    const page = record.page
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
      throw pdfError(
        'each edit requires a positive integer page number',
        'INVALID_REQUEST',
      )
    }
    if (record.kind === 'form') {
      const fieldName = record.fieldName
      const text = record.value
      if (typeof fieldName !== 'string' || fieldName.length === 0)
        throw pdfError('form edits require fieldName', 'INVALID_REQUEST')
      if (typeof text !== 'string')
        throw pdfError('form edits require a string value', 'INVALID_REQUEST')
      return { kind: 'form', page, fieldName, value: text }
    }
    if (record.kind === 'text') {
      const x = record.x
      const y = record.y
      const text = record.text
      if (typeof x !== 'number' || typeof y !== 'number')
        throw pdfError('text edits require numeric x and y', 'INVALID_REQUEST')
      if (typeof text !== 'string' || text.length === 0)
        throw pdfError('text edits require non-empty text', 'INVALID_REQUEST')
      return {
        kind: 'text',
        page,
        x,
        y,
        text,
        ...(typeof record.size === 'number' ? { size: record.size } : {}),
        ...(typeof record.color === 'string' ? { color: record.color } : {}),
      }
    }
    throw pdfError('each edit kind must be form or text', 'INVALID_REQUEST')
  })
}
