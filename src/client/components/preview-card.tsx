import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import * as React from 'react'
import type { FileState, WorktreeLifecycle } from '../../shared/wire/state.ts'
import {
  getFileState,
  getPdfContentUrl,
  performWorktreeAction,
} from '../api/pdf-api.ts'
import {
  type PdfTurnFile,
  selectPdfTurn,
} from '../conversation/pdf-turn-definition.ts'

/** Rich turn-tail review and live preview card for PDF worktrees. */
export function PreviewCard(
  props: TurnTailOwnerProps,
): React.ReactElement | null {
  const match = selectPdfTurn(props)
  if (match === null) return null

  const sessionId = ((props as { sessionId?: string }).sessionId ??
    (props.turn as unknown as { sessionId?: string }).sessionId ??
    '') as SessionId

  return React.createElement(
    'div',
    { 'data-plugin': 'dsh-pdf-maker', className: 'pdf-preview-card' },
    match.files.map((file) =>
      React.createElement(FilePreviewItem, {
        key: file.file,
        fileItem: file,
        sessionId,
      }),
    ),
  )
}

function FilePreviewItem({
  fileItem,
  sessionId,
}: {
  fileItem: PdfTurnFile
  sessionId: SessionId
}): React.ReactElement {
  const [fileState, setFileState] = React.useState<FileState | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [showViewer, setShowViewer] = React.useState<boolean>(true)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Find latest worktreeId in operations
  const latestOpWithWorktree = [...fileItem.operations]
    .reverse()
    .find((op) => op.worktreeId !== null && op.worktreeId.length > 0)
  const worktreeId = latestOpWithWorktree?.worktreeId ?? undefined

  const fetchState = React.useCallback(async () => {
    if (!sessionId) return
    try {
      const state = await getFileState(fileItem.file, sessionId)
      setFileState(state)
    } catch {
      // ignore
    }
  }, [fileItem.file, sessionId])

  React.useEffect(() => {
    fetchState()
  }, [fetchState])

  const currentWorktree = fileState?.worktrees.find(
    (wt) => wt.worktreeId === worktreeId,
  )
  const lifecycle: WorktreeLifecycle =
    currentWorktree?.lifecycle ?? (worktreeId ? 'draft' : 'ready')

  const handleAction = async (action: 'merge' | 'discard') => {
    if (!worktreeId || !sessionId) return
    setLoading(true)
    setErrorMsg(null)
    try {
      await performWorktreeAction(fileItem.file, sessionId, worktreeId, action)
      await fetchState()
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const contentUrl = getPdfContentUrl(fileItem.file, sessionId, worktreeId)

  return React.createElement(
    'div',
    {
      style: { display: 'flex', flexDirection: 'column', gap: '10px' },
    },
    // Header
    React.createElement(
      'div',
      { className: 'pdf-header' },
      React.createElement(
        'div',
        { className: 'pdf-file-title' },
        '📄 ',
        fileItem.file,
        worktreeId
          ? React.createElement(
              'span',
              { className: `pdf-badge pdf-badge-${lifecycle}` },
              lifecycle.toUpperCase(),
            )
          : null,
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'pdf-btn pdf-btn-secondary',
            style: { padding: '3px 8px', fontSize: '11px' },
            onClick: () => setShowViewer(!showViewer),
          },
          showViewer ? '收起预览' : '展开预览',
        ),
        React.createElement(
          'a',
          {
            href: contentUrl,
            target: '_blank',
            rel: 'noreferrer',
            className: 'pdf-btn pdf-btn-secondary',
            style: {
              padding: '3px 8px',
              fontSize: '11px',
              textDecoration: 'none',
            },
          },
          '新标签打开 ↗',
        ),
      ),
    ),
    // Live Viewer Area
    showViewer
      ? React.createElement(
          'div',
          { className: 'pdf-viewer-container' },
          React.createElement('iframe', {
            src: contentUrl,
            className: 'pdf-viewer-iframe',
            title: `PDF Preview: ${fileItem.file}`,
          }),
        )
      : null,
    // Operations Summary
    React.createElement(
      'div',
      { className: 'pdf-operations-list' },
      fileItem.operations.map((op) =>
        React.createElement(
          'span',
          { key: op.callId, className: 'pdf-op-tag' },
          `pdf_${op.name}${op.action ? `:${op.action}` : ''} [${op.phase}]`,
        ),
      ),
    ),
    // Error notification if action failed
    errorMsg
      ? React.createElement(
          'div',
          { style: { color: '#e11d48', fontSize: '12px' } },
          `操作失败: ${errorMsg}`,
        )
      : null,
    // Action Buttons
    worktreeId && (lifecycle === 'draft' || lifecycle === 'ready')
      ? React.createElement(
          'div',
          { className: 'pdf-actions' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pdf-btn pdf-btn-danger',
              disabled: loading,
              onClick: () => handleAction('discard'),
            },
            '放弃草稿 (Discard)',
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pdf-btn pdf-btn-success',
              disabled: loading,
              onClick: () => handleAction('merge'),
            },
            '采纳并合并 (Merge)',
          ),
        )
      : null,
  )
}
