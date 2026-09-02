import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { WorktreeActionResult } from '../../shared/wire/actions.ts'
import type { JsonValue } from '../service/types.ts'

/** Output schema shared by all PDF operation tools. */
export const operationOutput = {
  schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      ok: { type: 'boolean' as const, required: true, const: true },
      operation: {
        type: 'string' as const,
        required: true,
        enum: [
          'new',
          'status',
          'worktree',
          'edit',
          'export',
          'screenshot',
          'ocr',
        ] as const,
      },
      file: { type: 'string' as const, required: true },
      result: { type: 'json' as const, required: true },
    },
  },
  render: (_args: unknown, value: JsonValue) => [
    { type: 'text' as const, text: renderOperationResult(value) },
  ],
} as const

/** Pure text projection of a structured PDF operation result. */
export function renderOperationResult(value: JsonValue): string {
  return JSON.stringify(value)
}

/** Pure generic-card title for one PDF operation. */
export function operationTitle(operation: string, file: string): string {
  return `PDF ${operation}: ${file}`
}

/** Keep stable PDF failure codes visible to the model. */
export function withPdfErrorContent(
  definition: ToolDefinition,
): ToolDefinition {
  const finalizeContent = definition.finalizeContent?.bind(definition)
  return {
    ...definition,
    finalizeContent(exec, result) {
      if (result.isError && result.error.info?.name === 'PdfError') {
        const code = result.error.info.code
        if (typeof code === 'string') {
          return [
            { type: 'text', text: `Error [${code}]: ${result.error.message}` },
          ]
        }
      }
      return finalizeContent?.(exec, result)
    },
  }
}

/** The `result` field carries a WorktreeActionResult when a lifecycle ran. */
export type WorktreeActionResultValue = WorktreeActionResult
