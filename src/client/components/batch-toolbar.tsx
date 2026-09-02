import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import * as React from 'react'
import {
  applyManualEdits,
  buildAlternateMergeOrder,
} from '../api/pdf-api.ts'

interface BatchToolbarProps {
  file: string
  sessionId: SessionId
  worktreeId: string
  initialPageCount?: number | null | undefined
  onError?: (message: string) => void
  /** Called after an edit is applied so the preview can refresh. */
  onApplied?: () => void
}

/**
 * One-click PDF batch tools (ilovepdf-style): alternate-sort, A3->2x A4 split,
 * and merge. Each applies to the draft worktree via applyManualEdits.
 */
export function BatchToolbar({
  file,
  sessionId,
  worktreeId,
  initialPageCount,
  onError,
  onApplied,
}: BatchToolbarProps): React.ReactElement {
  const [busy, setBusy] = React.useState<string | null>(null)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [splitPages, setSplitPages] = React.useState<string>('')
  const [splitDirection, setSplitDirection] = React.useState<
    'vertical' | 'horizontal'
  >('vertical')
  const [mergeSources, setMergeSources] = React.useState<string>('')
  const [mergeAt, setMergeAt] = React.useState<string>('')
  const [extractPages, setExtractPages] = React.useState<string>('')

  const pageCount = initialPageCount ?? 0

  const run = async (label: string, edits: unknown[]) => {
    setBusy(label)
    setMsg(null)
    try {
      await applyManualEdits(file, sessionId, worktreeId, edits)
      setMsg(`${label} 完成 ✅`)
      onApplied?.()
    } catch (error) {
      const m = error instanceof Error ? error.message : String(error)
      setMsg(`${label} 失败`)
      onError?.(m)
    } finally {
      setBusy(null)
    }
  }

  const doAlternateSort = () => {
    const order = buildAlternateMergeOrder(pageCount)
    if (order.length === 0) return
    void run('交替排序', [{ kind: 'reorder_pages', order }])
  }

  const doSplit = () => {
    const pages = splitPages
      .split(/[,，\s]+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n >= 1)
    if (pages.length === 0) {
      setMsg('请输入要切分的页码（如 1 或 1,3）')
      return
    }
    void run('A3→A4 切分', [
      { kind: 'split_pages', pages, direction: splitDirection },
    ])
  }

  const doMerge = () => {
    const sources = mergeSources
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    if (sources.length === 0) {
      setMsg('请输入要合并的源 PDF 路径（逗号分隔）')
      return
    }
    const atPage = Number.parseInt(mergeAt, 10)
    const edit =
      Number.isInteger(atPage) && atPage >= 1
        ? { kind: 'merge_pages', sources, atPage }
        : { kind: 'merge_pages', sources }
    void run('合并 PDF', [edit])
  }

  const doExtract = () => {
    const pages = extractPages
      .split(/[,，\s]+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n >= 1)
    if (pages.length === 0) {
      setMsg('请输入要保留的页码（如 2,3）')
      return
    }
    void run('拆分 PDF', [{ kind: 'extract_pages', pages }])
  }

  return React.createElement(
    'div',
    { className: 'pdf-batch' },
    React.createElement(
      'div',
      { className: 'pdf-batch-title' },
      '⚙️ 批处理工具',
    ),
    // Row 1: alternate sort
    React.createElement(
      'div',
      { className: 'pdf-batch-row' },
      React.createElement(
        'span',
        { className: 'pdf-batch-desc' },
        `交替排序（${pageCount} 页，1,3,2,4 → 1,2,3,4）`,
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'pdf-btn pdf-btn-primary',
          style: { fontSize: '12px', padding: '4px 10px' },
          disabled: busy !== null || pageCount === 0,
          onClick: doAlternateSort,
        },
        '一键交替排序',
      ),
    ),
    // Row 2: A3 -> A4 split
    React.createElement(
      'div',
      { className: 'pdf-batch-row' },
      React.createElement('input', {
        type: 'text',
        className: 'pdf-text-input pdf-batch-input',
        placeholder: '要切分的页码，如 1 或 1,3',
        value: splitPages,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setSplitPages(e.target.value),
      }),
      React.createElement(
        'select',
        {
          className: 'pdf-select',
          value: splitDirection,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setSplitDirection(e.target.value as 'vertical' | 'horizontal'),
        },
        React.createElement('option', { value: 'vertical' }, '左右切分(A3横)'),
        React.createElement('option', { value: 'horizontal' }, '上下切分(A3竖)'),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'pdf-btn pdf-btn-primary',
          style: { fontSize: '12px', padding: '4px 10px' },
          disabled: busy !== null,
          onClick: doSplit,
        },
        'A3→A4 切分',
      ),
    ),
    // Row 3: merge
    React.createElement(
      'div',
      { className: 'pdf-batch-row' },
      React.createElement('input', {
        type: 'text',
        className: 'pdf-text-input pdf-batch-input',
        placeholder: '合并源 PDF 路径（逗号分隔）',
        value: mergeSources,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setMergeSources(e.target.value),
      }),
      React.createElement('input', {
        type: 'text',
        className: 'pdf-text-input pdf-batch-input-small',
        placeholder: '插入位置(可选)',
        value: mergeAt,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setMergeAt(e.target.value),
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'pdf-btn pdf-btn-primary',
          style: { fontSize: '12px', padding: '4px 10px' },
          disabled: busy !== null,
          onClick: doMerge,
        },
        '合并 PDF',
      ),
    ),
    // Row 4: split / extract
    React.createElement(
      'div',
      { className: 'pdf-batch-row' },
      React.createElement('input', {
        type: 'text',
        className: 'pdf-text-input pdf-batch-input',
        placeholder: `要保留的页码，如 2,3（共 ${pageCount} 页）`,
        value: extractPages,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setExtractPages(e.target.value),
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'pdf-btn pdf-btn-primary',
          style: { fontSize: '12px', padding: '4px 10px' },
          disabled: busy !== null,
          onClick: doExtract,
        },
        '拆分 PDF',
      ),
    ),
    busy !== null
      ? React.createElement('div', { className: 'pdf-batch-status' }, `⏳ ${busy}…`)
      : msg !== null
        ? React.createElement('div', { className: 'pdf-batch-status' }, msg)
        : null,
  )
}
