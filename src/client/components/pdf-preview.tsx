import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import * as React from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PdfTurnOperation } from '../conversation/pdf-turn-definition.ts'
import { applyManualEdits, fetchPdfBytes } from '../api/pdf-api.ts'
import { getPdfWorkerSrc } from '../api/pdf-api.ts'
import { PdfViewerPanel } from './pdf-viewer-panel.tsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc()

export type PreviewMode = 'thumbnails' | 'full'

/** Operations that rearrange the page structure → prefer thumbnail mode. */
const STRUCTURAL_OPS = new Set([
  'reorder_pages',
  'delete_pages',
  'rotate_pages',
  'insert_pages',
])

export function isStructuralOperation(name: string): boolean {
  return STRUCTURAL_OPS.has(name)
}

/** Recommend a preview mode from the turn's PDF operations. */
export function recommendMode(ops: readonly PdfTurnOperation[]): PreviewMode {
  for (const op of ops) {
    if (op.phase === 'failed') continue
    const name = op.name === 'edit' && op.action ? op.action : op.name
    if (STRUCTURAL_OPS.has(name)) return 'thumbnails'
  }
  return 'full'
}

interface PdfPreviewProps {
  file: string
  sessionId: SessionId
  worktreeId?: string | undefined
  operations?: readonly PdfTurnOperation[] | undefined
  onError?: (message: string) => void
  /** External page order (e.g. the visual-editing toolbar's order). */
  externalOrder?: readonly number[] | undefined
  /** Called when the thumbnail drag reorders pages. */
  onOrderChange?: (order: number[]) => void
}

/**
 * Two-mode PDF preview:
 *  - thumbnails: a grid of page thumbnails with drag-to-reorder (structural ops)
 *  - full: the pdfjs PDFViewer with page/zoom/fit controls (content ops)
 * The initial mode is recommended from the operations, but can be toggled.
 */
export function PdfPreview({
  file,
  sessionId,
  worktreeId,
  operations,
  onError,
  externalOrder,
  onOrderChange,
}: PdfPreviewProps): React.ReactElement {
  const [mode, setMode] = React.useState<PreviewMode>(() =>
    recommendMode(operations ?? []),
  )

  // Re-apply the recommendation whenever the operations change and the user
  // hasn't manually overridden (track a manual override flag).
  const [manualOverride, setManualOverride] = React.useState<boolean>(false)
  React.useEffect(() => {
    if (manualOverride) return
    setMode(recommendMode(operations ?? []))
  }, [operations, manualOverride])

  const switchTo = (next: PreviewMode) => {
    setManualOverride(true)
    setMode(next)
  }

  return React.createElement(
    'div',
    { className: 'pdf-preview' },
    React.createElement(
      'div',
      { className: 'pdf-preview-modes' },
      React.createElement(ModeButton, {
        label: '缩略图',
        active: mode === 'thumbnails',
        onClick: () => switchTo('thumbnails'),
      }),
      React.createElement(ModeButton, {
        label: '完整预览',
        active: mode === 'full',
        onClick: () => switchTo('full'),
      }),
    ),
    mode === 'thumbnails'
      ? React.createElement(ThumbnailGrid, {
          file,
          sessionId,
          ...(worktreeId !== undefined ? { worktreeId } : {}),
          ...(onError !== undefined ? { onError } : {}),
          ...(externalOrder !== undefined ? { externalOrder } : {}),
          ...(onOrderChange !== undefined ? { onOrderChange } : {}),
        })
      : React.createElement(PdfViewerPanel, {
          file,
          sessionId,
          ...(worktreeId !== undefined ? { worktreeId } : {}),
          ...(onError !== undefined ? { onError } : {}),
        }),
  )
}

interface ModeButtonProps {
  label: string
  active: boolean
  onClick: () => void
}

function ModeButton({ label, active, onClick }: ModeButtonProps): React.ReactElement {
  return React.createElement(
    'button',
    {
      type: 'button',
      className: `pdf-preview-mode${active ? ' pdf-preview-mode-active' : ''}`,
      onClick,
    },
    label,
  )
}

interface ThumbnailGridProps {
  file: string
  sessionId: SessionId
  worktreeId?: string | undefined
  onError?: (message: string) => void
  externalOrder?: readonly number[] | undefined
  onOrderChange?: (order: number[]) => void
}

interface Thumb {
  readonly num: number
  readonly dataUrl: string
}

function ThumbnailGrid({
  file,
  sessionId,
  worktreeId,
  onError,
  externalOrder,
  onOrderChange,
}: ThumbnailGridProps): React.ReactElement {
  const [thumbs, setThumbs] = React.useState<Thumb[]>([])
  const [order, setOrder] = React.useState<number[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<boolean>(false)
  const gridRef = React.useRef<HTMLDivElement | null>(null)

  // Drag state
  const [dragIdx, setDragIdx] = React.useState<number | null>(null)
  const [ghost, setGhost] = React.useState<{ x: number; y: number } | null>(null)
  const dragPointerRef = React.useRef<number | null>(null)
  const dragTargetRef = React.useRef<number | null>(null)
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null)
  const activeRef = React.useRef<boolean>(false)
  const justDraggedRef = React.useRef<boolean>(false)
  const onMoveRef = React.useRef<(e: PointerEvent) => void>(() => {})
  const onEndRef = React.useRef<() => void>(() => {})

  // Render thumbnails for every page.
  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setThumbs([])
    setOrder([])
    ;(async () => {
      try {
        const bytes = await fetchPdfBytes(file, sessionId, worktreeId)
        const task = pdfjsLib.getDocument({ data: bytes })
        const doc = await task.promise
        if (cancelled) {
          void task.destroy()
          return
        }
        const count = doc.numPages
        const list: Thumb[] = []
        for (let n = 1; n <= count; n += 1) {
          const page = await doc.getPage(n)
          const viewport = page.getViewport({ scale: 0.35 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          if (ctx === null) {
            page.cleanup()
            continue
          }
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          list.push({ num: n, dataUrl: canvas.toDataURL('image/png') })
          page.cleanup()
        }
        if (!cancelled) {
          setThumbs(list)
          // Seed order from the external order if it's a valid permutation of
          // 1..count; otherwise fall back to natural order.
          const natural = list.map((t) => t.num)
          if (
            externalOrder !== undefined &&
            externalOrder.length === count &&
            externalOrder.every(
              (n) => Number.isInteger(n) && n >= 1 && n <= count,
            ) &&
            new Set(externalOrder).size === count
          ) {
            setOrder([...externalOrder])
          } else {
            setOrder(natural)
          }
        }
        void task.destroy()
      } catch (err) {
        if (!cancelled) {
          console.error('[PDF-MAKER] thumb render error:', err)
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
          onError?.(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, sessionId, worktreeId])

  const startDrag = (e: React.PointerEvent, idx: number) => {
    if (dragIdx !== null || busy) return
    if ((e.target as HTMLElement).closest('button') !== null) return
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture?.(e.pointerId)
    dragPointerRef.current = e.pointerId
    dragTargetRef.current = idx
    startPosRef.current = { x: e.clientX, y: e.clientY }
    activeRef.current = false
    justDraggedRef.current = false
    window.addEventListener('pointermove', onMoveRef.current)
    window.addEventListener('pointerup', onEndRef.current)
    window.addEventListener('pointercancel', onEndRef.current)
  }

  const handleMove = (e: PointerEvent) => {
    if (dragPointerRef.current === null || !gridRef.current) return
    const start = startPosRef.current
    if (!activeRef.current && start !== null) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) < 6) return
      activeRef.current = true
      justDraggedRef.current = true
      setDragIdx(dragTargetRef.current)
    }
    if (!activeRef.current) return
    setGhost({ x: e.clientX, y: e.clientY })
    const fromIdx = dragTargetRef.current
    if (fromIdx === null) return
    const cells = Array.from(
      gridRef.current.querySelectorAll<HTMLElement>('[data-thumb-slot]'),
    )
    for (const el of cells) {
      const rect = el.getBoundingClientRect()
      if (e.clientX < rect.left || e.clientX > rect.right) continue
      if (e.clientY < rect.top || e.clientY > rect.bottom) continue
      const slotStr = el.getAttribute('data-thumb-slot')
      if (slotStr === null) break
      const slot = Number.parseInt(slotStr, 10)
      if (Number.isNaN(slot) || slot === fromIdx) break
      setOrder((prev) => {
        const copy = [...prev]
        const [moved] = copy.splice(fromIdx, 1)
        if (moved !== undefined) copy.splice(slot, 0, moved)
        return copy
      })
      dragTargetRef.current = slot
      setDragIdx(slot)
      break
    }
  }

  const persist = async (finalOrder: number[]) => {
    // Notify the parent (visual-editing toolbar) so its page order stays in sync.
    onOrderChange?.(finalOrder)
    if (worktreeId === null || worktreeId === undefined) return
    setBusy(true)
    try {
      await applyManualEdits(file, sessionId, worktreeId, [
        { kind: 'reorder_pages', order: finalOrder },
      ])
    } catch (err) {
      console.error('[PDF-MAKER] reorder persist failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      onError?.(message)
    } finally {
      setBusy(false)
    }
  }

  const endDrag = () => {
    window.removeEventListener('pointermove', onMoveRef.current)
    window.removeEventListener('pointerup', onEndRef.current)
    window.removeEventListener('pointercancel', onEndRef.current)
    if (dragPointerRef.current !== null) {
      try {
        gridRef.current?.releasePointerCapture?.(dragPointerRef.current)
      } catch {
        // already released
      }
    }
    dragPointerRef.current = null
    dragTargetRef.current = null
    startPosRef.current = null
    activeRef.current = false
    setGhost(null)
    setDragIdx(null)

    const wasDrag = justDraggedRef.current
    justDraggedRef.current = false
    if (wasDrag) void persist(order)
  }

  onMoveRef.current = handleMove
  onEndRef.current = endDrag

  if (loading) {
    return React.createElement(
      'div',
      { className: 'pdf-thumb-status' },
      '⏳ 正在渲染缩略图…',
    )
  }
  if (error !== null) {
    return React.createElement(
      'div',
      { className: 'pdf-thumb-status pdf-thumb-error' },
      React.createElement('div', null, '⚠️ 缩略图加载失败'),
      React.createElement('div', { className: 'pdf-thumb-error-msg' }, error),
    )
  }
  if (order.length === 0) {
    return React.createElement(
      'div',
      { className: 'pdf-thumb-status' },
      '无可用页面',
    )
  }

  return React.createElement(
    'div',
    { className: 'pdf-thumb-wrap' },
    React.createElement(
      'div',
      { className: 'pdf-thumb-hint' },
      busy ? '正在保存顺序…' : '按住缩略图拖动可排序，松手后保存到草稿',
    ),
    React.createElement(
      'div',
      { ref: gridRef, className: 'pdf-thumb-grid' },
      order.map((pageNum, idx) => {
        const thumb = thumbs.find((t) => t.num === pageNum)
        return React.createElement(
          'div',
          {
            key: `thumb-${pageNum}`,
            'data-thumb-slot': String(idx),
            className: `pdf-thumb-card ${dragIdx === idx ? 'is-dragging' : ''}`,
            onPointerDown: (e: React.PointerEvent) => startDrag(e, idx),
          },
          React.createElement(
            'div',
            { className: 'pdf-thumb-num' },
            `第 ${pageNum} 页`,
          ),
          thumb !== undefined
            ? React.createElement('img', {
                className: 'pdf-thumb-img',
                src: thumb.dataUrl,
                alt: `第 ${pageNum} 页`,
                draggable: false,
              })
            : null,
        )
      }),
      ghost !== null && dragIdx !== null
        ? React.createElement(
            'div',
            {
              className: 'pdf-thumb-ghost',
              style: { left: ghost.x, top: ghost.y },
            },
            `第 ${order[dragIdx] ?? ''} 页`,
          )
        : null,
    ),
  )
}
