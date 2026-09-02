import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import * as React from 'react'
import type { FileState, WorktreeLifecycle } from '../../shared/wire/state.ts'
import {
  applyManualEdits,
  getFileState,
  getPdfContentUrl,
  performWorktreeAction,
} from '../api/pdf-api.ts'
import {
  type PdfTurnFile,
  type PdfTurnMatch,
  selectPdfTurn,
} from '../conversation/pdf-turn-definition.ts'
import { PdfPreview } from './pdf-preview.tsx'
import { BatchToolbar } from './batch-toolbar.tsx'

/** Rich turn-tail review and live preview card with visual manual editing toolbox. */
export function PreviewCard(
  props: TurnTailOwnerProps & {
    matched?: PdfTurnMatch
    sessionId?: SessionId
  },
): React.ReactElement | null {
  try {
    const match = props.matched ?? selectPdfTurn(props)
    if (
      match === null ||
      !Array.isArray(match.files) ||
      match.files.length === 0
    )
      return null

    const sessionId = (props.sessionId ??
      (props as { turn?: { sessionId?: string } }).turn?.sessionId ??
      '') as SessionId

    return React.createElement(
      'div',
      { 'data-plugin': 'dsh-pdf-maker', className: 'pdf-preview-card' },
      match.files.map((file: PdfTurnFile) =>
        React.createElement(FilePreviewItem, {
          key: file.file,
          fileItem: file,
          sessionId,
        }),
      ),
    )
  } catch (err) {
    console.error('[PDF-MAKER] PreviewCard render error:', err)
    return null
  }
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
  const [showToolbox, setShowToolbox] = React.useState<boolean>(false)
  const [showBatch, setShowBatch] = React.useState<boolean>(false)
  const [activeTab, setActiveTab] = React.useState<
    'watermark' | 'page_number' | 'flatten'
  >('watermark')
  const [watermarkText, setWatermarkText] = React.useState<string>('内部机密')
  const [pageNumberFormat, setPageNumberFormat] = React.useState<string>(
    '第 {page} 页 / 共 {total} 页',
  )
  const [pageNumberPos, setPageNumberPos] = React.useState<
    'bottom_center' | 'bottom_right' | 'top_center' | 'top_right'
  >('bottom_center')
  const [pagesOrder, setPagesOrder] = React.useState<number[]>([])
  // Bumped only when the underlying content really changes (edits/lifecycle),
  // so the viewer iframe reloads exactly once per change — never per render.
  const [refreshSalt, setRefreshSalt] = React.useState<number>(0)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  // If the client-side page renderer fails (pdfjs/worker), fall back to the
  // native PDF iframe so the preview card never disappears.
  const [pageViewFailed, setPageViewFailed] = React.useState<boolean>(false)
  // Fullscreen overlay: a large "separate window" for the page preview.
  const [fullscreen, setFullscreen] = React.useState<boolean>(false)

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
      if (state.pages && state.pages.length > 0) {
        setPagesOrder(state.pages.map((p) => p.page))
      } else if (state.pageCount) {
        setPagesOrder(Array.from({ length: state.pageCount }, (_, i) => i + 1))
      }
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
      setRefreshSalt((salt) => salt + 1)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const runManualEdit = async (edits: unknown[]) => {
    if (!worktreeId || !sessionId) return
    setLoading(true)
    setErrorMsg(null)
    try {
      await applyManualEdits(fileItem.file, sessionId, worktreeId, edits)
      await fetchState()
      setRefreshSalt((salt) => salt + 1)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const contentUrl = React.useMemo(
    () => getPdfContentUrl(fileItem.file, sessionId, worktreeId, refreshSalt),
    [fileItem.file, sessionId, worktreeId, refreshSalt],
  )

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
        worktreeId
          ? React.createElement(
              'button',
              {
                type: 'button',
                className: `pdf-btn ${showToolbox ? 'pdf-btn-primary' : 'pdf-btn-secondary'}`,
                style: { padding: '3px 8px', fontSize: '11px' },
                onClick: () => setShowToolbox(!showToolbox),
              },
              '🛠️ 可视化编辑',
            )
          : null,
        worktreeId
          ? React.createElement(
              'button',
              {
                type: 'button',
                className: `pdf-btn ${showBatch ? 'pdf-btn-primary' : 'pdf-btn-secondary'}`,
                style: { padding: '3px 8px', fontSize: '11px' },
                onClick: () => setShowBatch(!showBatch),
              },
              '⚙️ 批处理工具',
            )
          : null,
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
        worktreeId
          ? React.createElement(
              'button',
              {
                type: 'button',
                className: 'pdf-btn pdf-btn-secondary',
                style: { padding: '3px 8px', fontSize: '11px' },
                onClick: () => setFullscreen(true),
              },
              '⛶ 大窗口预览',
            )
          : null,
      ),
    ),

    // Batch tools panel (alternate sort / A3 split / merge)
    showBatch && worktreeId
      ? React.createElement(BatchToolbar, {
          file: fileItem.file,
          sessionId,
          worktreeId,
          initialPageCount: fileState?.pageCount,
          onError: (message) => setErrorMsg(message),
          onApplied: () => {
            void fetchState()
            setRefreshSalt((salt) => salt + 1)
          },
        })
      : null,

    // Visual Manual Editing Toolbox
    showToolbox && worktreeId
      ? React.createElement(
          'div',
          { className: 'pdf-toolbox' },
          // Tabs
          React.createElement(
            'div',
            { className: 'pdf-toolbox-tabs' },
            React.createElement(
              'button',
              {
                type: 'button',
                className: `pdf-tab-btn ${activeTab === 'watermark' ? 'active' : ''}`,
                onClick: () => setActiveTab('watermark'),
              },
              '🌊 添加水印',
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: `pdf-tab-btn ${activeTab === 'page_number' ? 'active' : ''}`,
                onClick: () => setActiveTab('page_number'),
              },
              '🔢 编制页码',
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: `pdf-tab-btn ${activeTab === 'flatten' ? 'active' : ''}`,
                onClick: () => setActiveTab('flatten'),
              },
              '🔒 表单压平',
            ),
          ),

          // Tab 2: Watermark
          activeTab === 'watermark'
            ? React.createElement(
                'div',
                { className: 'pdf-input-row' },
                React.createElement('input', {
                  type: 'text',
                  className: 'pdf-text-input',
                  placeholder: '水印文字，例如：内部机密',
                  value: watermarkText,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    setWatermarkText(e.target.value),
                }),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'pdf-btn pdf-btn-primary',
                    style: { fontSize: '11px' },
                    disabled: loading || !watermarkText,
                    onClick: () =>
                      runManualEdit([
                        {
                          kind: 'watermark',
                          text: watermarkText,
                          opacity: 0.18,
                          rotation: 45,
                        },
                      ]),
                  },
                  '应用斜向水印',
                ),
              )
            : null,

          // Tab 3: Page Number
          activeTab === 'page_number'
            ? React.createElement(
                'div',
                { className: 'pdf-input-row' },
                React.createElement('input', {
                  type: 'text',
                  className: 'pdf-text-input',
                  style: { width: '220px' },
                  value: pageNumberFormat,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    setPageNumberFormat(e.target.value),
                }),
                React.createElement(
                  'select',
                  {
                    className: 'pdf-select',
                    value: pageNumberPos,
                    onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                      setPageNumberPos(e.target.value as typeof pageNumberPos),
                  },
                  React.createElement(
                    'option',
                    { value: 'bottom_center' },
                    '底部居中',
                  ),
                  React.createElement(
                    'option',
                    { value: 'bottom_right' },
                    '底部靠右',
                  ),
                  React.createElement(
                    'option',
                    { value: 'top_center' },
                    '顶部居中',
                  ),
                  React.createElement(
                    'option',
                    { value: 'top_right' },
                    '顶部靠右',
                  ),
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'pdf-btn pdf-btn-primary',
                    style: { fontSize: '11px' },
                    disabled: loading,
                    onClick: () =>
                      runManualEdit([
                        {
                          kind: 'page_number',
                          format: pageNumberFormat,
                          position: pageNumberPos,
                        },
                      ]),
                  },
                  '一键生成页码',
                ),
              )
            : null,

          // Tab 4: Flatten
          activeTab === 'flatten'
            ? React.createElement(
                'div',
                { className: 'pdf-input-row' },
                React.createElement(
                  'span',
                  { style: { fontSize: '12px', color: '#64748b' } },
                  '压平后表单域将变为静态图形文字，不可再次修改输入：',
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'pdf-btn pdf-btn-danger',
                    style: { fontSize: '11px' },
                    disabled: loading,
                    onClick: () => runManualEdit([{ kind: 'flatten' }]),
                  },
                  '🔒 确认压平表单',
                ),
              )
            : null,
        )
      : null,

    // Live Viewer Area: two-mode preview (thumbnails for structure ops, full
    // viewer for content ops).
    showViewer
      ? React.createElement(
          'div',
          { className: 'pdf-viewer-container' },
          React.createElement(PdfPreview, {
            file: fileItem.file,
            sessionId,
            worktreeId,
            operations: fileItem.operations,
            externalOrder: pagesOrder,
            onOrderChange: setPagesOrder,
            onError: (message) => {
              setErrorMsg(message)
              setPageViewFailed(true)
            },
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

    // Fullscreen "separate window" preview overlay.
    fullscreen
      ? React.createElement(
          'div',
          { className: 'pdf-fullscreen-overlay' },
          React.createElement(
            'div',
            { className: 'pdf-fullscreen-bar' },
            React.createElement(
              'span',
              { className: 'pdf-fullscreen-title' },
              '📄 ',
              fileItem.file,
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: '6px' } },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'pdf-btn pdf-btn-secondary',
                  style: { padding: '4px 10px', fontSize: '12px' },
                  onClick: () => setFullscreen(false),
                },
                '✕ 关闭',
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'pdf-fullscreen-body' },
            React.createElement(PdfPreview, {
              file: fileItem.file,
              sessionId,
              worktreeId,
              operations: fileItem.operations,
              externalOrder: pagesOrder,
              onOrderChange: setPagesOrder,
              onError: (message) => {
                setErrorMsg(message)
                setPageViewFailed(true)
              },
            }),
          ),
        )
      : null,
  )
}
