import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import * as React from 'react'
import { selectPdfTurn } from '../conversation/pdf-turn-definition.ts'

/** Compact turn-tail review card for PDF worktrees in one conversation Turn. */
export function PreviewCard(
  props: TurnTailOwnerProps,
): React.ReactElement | null {
  const match = selectPdfTurn(props)
  if (match === null) return null
  const files = match.files
  return React.createElement(
    'div',
    { 'data-plugin': 'dsh-pdf-maker', className: 'pdf-preview-card' },
    files.map((file) =>
      React.createElement(
        'div',
        { key: file.file },
        React.createElement('div', null, file.file),
        React.createElement(
          'div',
          { className: 'pdf-preview-empty' },
          `${file.operations.length} PDF operation(s) — preview panel wiring in progress`,
        ),
      ),
    ),
  )
}
