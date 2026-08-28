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
      'Apply structured edits (form fill, form_create, line, or text) to an isolated draft worktree of a PDF, then ready it for review. Never edits the trunk directly.',
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
        description:
          'Structured edits to apply (form, form_create, text, or line).',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: {
              type: 'string',
              required: true,
              enum: ['form', 'form_create', 'text', 'line'],
              description: 'Edit command kind.',
            },
            page: {
              type: 'integer',
              required: true,
              description: '1-based page number.',
            },
            fieldName: {
              type: 'string',
              description: 'Form field name when kind is form or form_create.',
            },
            value: {
              type: 'string',
              description: 'Form field value when kind is form.',
            },
            defaultValue: {
              type: 'string',
              description: 'Initial value when kind is form_create.',
            },
            style: {
              type: 'string',
              enum: ['underline', 'light', 'borderless'],
              description:
                'Form field visual style when kind is form_create. Defaults to underline.',
            },
            fontSize: {
              type: 'number',
              description: 'Optional font size for text or form field value.',
            },
            x: {
              type: 'number',
              description:
                'X position in PDF points when kind is text or form_create.',
            },
            y: {
              type: 'number',
              description:
                'Y position (baseline for text, bottom-left for form_create) in PDF points.',
            },
            width: {
              type: 'number',
              description:
                'Field width in PDF points when kind is form_create.',
            },
            height: {
              type: 'number',
              description:
                'Field height in PDF points when kind is form_create.',
            },
            text: {
              type: 'string',
              description: 'Text to draw when kind is text.',
            },
            size: {
              type: 'number',
              description: 'Optional font size when kind is text.',
            },
            color: {
              type: 'string',
              description: 'Optional #rrggbb color for text or line.',
            },
            x1: {
              type: 'number',
              description: 'Start X in PDF points when kind is line.',
            },
            y1: {
              type: 'number',
              description: 'Start Y in PDF points when kind is line.',
            },
            x2: {
              type: 'number',
              description: 'End X in PDF points when kind is line.',
            },
            y2: {
              type: 'number',
              description: 'End Y in PDF points when kind is line.',
            },
            thickness: {
              type: 'number',
              description: 'Line thickness in points when kind is line.',
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
      return {
        kind: 'form',
        page,
        fieldName,
        value: text,
        ...(typeof record.fontSize === 'number'
          ? { fontSize: record.fontSize }
          : {}),
      }
    }
    if (record.kind === 'form_create') {
      const fieldName = record.fieldName
      const x = record.x
      const y = record.y
      const width = record.width
      const height = record.height
      if (typeof fieldName !== 'string' || fieldName.length === 0)
        throw pdfError('form_create edits require fieldName', 'INVALID_REQUEST')
      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number'
      ) {
        throw pdfError(
          'form_create edits require numeric x, y, width, and height',
          'INVALID_REQUEST',
        )
      }
      const style = record.style
      const validStyle =
        style === 'underline' || style === 'light' || style === 'borderless'
          ? style
          : undefined
      return {
        kind: 'form_create',
        page,
        fieldName,
        x,
        y,
        width,
        height,
        ...(validStyle !== undefined ? { style: validStyle } : {}),
        ...(typeof record.defaultValue === 'string'
          ? { defaultValue: record.defaultValue }
          : {}),
        ...(typeof record.fontSize === 'number'
          ? { fontSize: record.fontSize }
          : {}),
      }
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
    if (record.kind === 'line') {
      const x1 = record.x1
      const y1 = record.y1
      const x2 = record.x2
      const y2 = record.y2
      if (
        typeof x1 !== 'number' ||
        typeof y1 !== 'number' ||
        typeof x2 !== 'number' ||
        typeof y2 !== 'number'
      ) {
        throw pdfError(
          'line edits require numeric x1, y1, x2, and y2',
          'INVALID_REQUEST',
        )
      }
      return {
        kind: 'line',
        page,
        x1,
        y1,
        x2,
        y2,
        ...(typeof record.thickness === 'number'
          ? { thickness: record.thickness }
          : {}),
        ...(typeof record.color === 'string' ? { color: record.color } : {}),
      }
    }
    throw pdfError(
      'each edit kind must be form, form_create, text, or line',
      'INVALID_REQUEST',
    )
  })
}
