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
              enum: [
                'form',
                'form_create',
                'text',
                'line',
                'reorder_pages',
                'delete_pages',
                'rotate_pages',
                'insert_pages',
                'watermark',
                'page_number',
                'flatten',
                'metadata',
              ],
              description: 'Edit command kind.',
            },
            page: {
              type: 'integer',
              description:
                '1-based page number (required for form, form_create, text, line).',
            },
            order: {
              type: 'array',
              description:
                'New 1-based page order array when kind is reorder_pages (e.g. [3, 1, 2]).',
            },
            pages: {
              type: 'array',
              description:
                '1-based page numbers array for delete_pages, rotate_pages, watermark, or page_number.',
            },
            degrees: {
              type: 'number',
              description:
                'Rotation angle in degrees (90, 180, 270, -90) when kind is rotate_pages.',
            },
            sourceFile: {
              type: 'string',
              description: 'Path to source PDF file when kind is insert_pages.',
            },
            sourcePages: {
              type: 'array',
              description:
                '1-based page numbers to copy when kind is insert_pages.',
            },
            atPage: {
              type: 'integer',
              description:
                '1-based target insertion index when kind is insert_pages.',
            },
            opacity: {
              type: 'number',
              description: 'Opacity (0..1) when kind is watermark.',
            },
            rotation: {
              type: 'number',
              description:
                'Rotation angle in degrees when kind is watermark (default 45).',
            },
            format: {
              type: 'string',
              description:
                'Page number template (e.g. "第 {page} 页 / 共 {total} 页") when kind is page_number.',
            },
            position: {
              type: 'string',
              enum: [
                'bottom_center',
                'bottom_right',
                'top_center',
                'top_right',
              ],
              description: 'Page number position when kind is page_number.',
            },
            startFrom: {
              type: 'integer',
              description:
                'Starting page number offset when kind is page_number.',
            },
            title: {
              type: 'string',
              description: 'Document title when kind is metadata.',
            },
            author: {
              type: 'string',
              description: 'Document author when kind is metadata.',
            },
            subject: {
              type: 'string',
              description: 'Document subject when kind is metadata.',
            },
            keywords: {
              type: 'array',
              description: 'Document keywords array when kind is metadata.',
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
              description:
                'Optional font size for text, form, watermark, or page_number.',
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
              description: 'Text to draw when kind is text or watermark.',
            },
            size: {
              type: 'number',
              description: 'Optional font size when kind is text.',
            },
            color: {
              type: 'string',
              description:
                'Optional #rrggbb color for text, line, watermark, or page_number.',
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

    if (record.kind === 'reorder_pages') {
      if (!Array.isArray(record.order) || record.order.length === 0) {
        throw pdfError(
          'reorder_pages requires non-empty order array',
          'INVALID_REQUEST',
        )
      }
      return {
        kind: 'reorder_pages',
        order: record.order.map((n) => {
          if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
            throw pdfError(
              'each order item must be a positive 1-based page integer',
              'INVALID_REQUEST',
            )
          }
          return n
        }),
      }
    }

    if (record.kind === 'delete_pages') {
      if (!Array.isArray(record.pages) || record.pages.length === 0) {
        throw pdfError(
          'delete_pages requires non-empty pages array',
          'INVALID_REQUEST',
        )
      }
      return {
        kind: 'delete_pages',
        pages: record.pages.map((n) => {
          if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
            throw pdfError(
              'each page to delete must be a positive 1-based page integer',
              'INVALID_REQUEST',
            )
          }
          return n
        }),
      }
    }

    if (record.kind === 'rotate_pages') {
      const degrees = record.degrees
      if (
        degrees !== 90 &&
        degrees !== 180 &&
        degrees !== 270 &&
        degrees !== -90 &&
        degrees !== -180 &&
        degrees !== -270
      ) {
        throw pdfError(
          'rotate_pages requires degrees to be 90, 180, 270, -90, -180, or -270',
          'INVALID_REQUEST',
        )
      }
      const pages = Array.isArray(record.pages)
        ? record.pages.map((n) => {
            if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
              throw pdfError(
                'each page in pages must be a positive integer',
                'INVALID_REQUEST',
              )
            }
            return n
          })
        : undefined
      return {
        kind: 'rotate_pages',
        degrees,
        ...(pages !== undefined ? { pages } : {}),
      }
    }

    if (record.kind === 'insert_pages') {
      if (
        typeof record.sourceFile !== 'string' ||
        record.sourceFile.length === 0
      ) {
        throw pdfError('insert_pages requires sourceFile', 'INVALID_REQUEST')
      }
      const sourcePages = Array.isArray(record.sourcePages)
        ? record.sourcePages.map((n) => {
            if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
              throw pdfError(
                'each page in sourcePages must be a positive integer',
                'INVALID_REQUEST',
              )
            }
            return n
          })
        : undefined
      const atPage =
        typeof record.atPage === 'number' && Number.isInteger(record.atPage)
          ? record.atPage
          : undefined
      return {
        kind: 'insert_pages',
        sourceFile: record.sourceFile,
        ...(sourcePages !== undefined ? { sourcePages } : {}),
        ...(atPage !== undefined ? { atPage } : {}),
      }
    }

    if (record.kind === 'watermark') {
      if (typeof record.text !== 'string' || record.text.length === 0) {
        throw pdfError('watermark requires non-empty text', 'INVALID_REQUEST')
      }
      const pages = Array.isArray(record.pages)
        ? record.pages.map((n) => {
            if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
              throw pdfError(
                'each page in pages must be a positive integer',
                'INVALID_REQUEST',
              )
            }
            return n
          })
        : undefined
      return {
        kind: 'watermark',
        text: record.text,
        ...(typeof record.opacity === 'number'
          ? { opacity: record.opacity }
          : {}),
        ...(typeof record.rotation === 'number'
          ? { rotation: record.rotation }
          : {}),
        ...(typeof record.fontSize === 'number'
          ? { fontSize: record.fontSize }
          : {}),
        ...(typeof record.color === 'string' ? { color: record.color } : {}),
        ...(pages !== undefined ? { pages } : {}),
      }
    }

    if (record.kind === 'page_number') {
      const pages = Array.isArray(record.pages)
        ? record.pages.map((n) => {
            if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
              throw pdfError(
                'each page in pages must be a positive integer',
                'INVALID_REQUEST',
              )
            }
            return n
          })
        : undefined
      const position = record.position
      const validPosition =
        position === 'bottom_center' ||
        position === 'bottom_right' ||
        position === 'top_center' ||
        position === 'top_right'
          ? position
          : undefined
      return {
        kind: 'page_number',
        ...(typeof record.format === 'string' ? { format: record.format } : {}),
        ...(validPosition !== undefined ? { position: validPosition } : {}),
        ...(typeof record.startFrom === 'number'
          ? { startFrom: record.startFrom }
          : {}),
        ...(typeof record.fontSize === 'number'
          ? { fontSize: record.fontSize }
          : {}),
        ...(typeof record.color === 'string' ? { color: record.color } : {}),
        ...(pages !== undefined ? { pages } : {}),
      }
    }

    if (record.kind === 'flatten') {
      return { kind: 'flatten' }
    }

    if (record.kind === 'metadata') {
      const keywords = Array.isArray(record.keywords)
        ? record.keywords.filter((k): k is string => typeof k === 'string')
        : undefined
      return {
        kind: 'metadata',
        ...(typeof record.title === 'string' ? { title: record.title } : {}),
        ...(typeof record.author === 'string' ? { author: record.author } : {}),
        ...(typeof record.subject === 'string'
          ? { subject: record.subject }
          : {}),
        ...(keywords !== undefined ? { keywords } : {}),
      }
    }

    const page = record.page
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
      throw pdfError(
        'this edit requires a positive integer page number',
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
    throw pdfError('unrecognized edit kind', 'INVALID_REQUEST')
  })
}
