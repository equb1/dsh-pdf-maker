import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import * as React from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  EventBus,
  PDFLinkService,
  PDFViewer,
} from 'pdfjs-dist/web/pdf_viewer.mjs'
import { fetchPdfBytes, getPdfWorkerSrc } from '../api/pdf-api.ts'

// Resolve the bundled worker from the same origin.
pdfjsLib.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc()

interface PdfViewerPanelProps {
  file: string
  sessionId: SessionId
  worktreeId?: string | undefined
  /** Report an error to the parent for display. */
  onError?: (message: string) => void
}

/**
 * Full PDF viewer built on pdfjs-dist's PDFViewer component. Renders the whole
 * document and supports zoom (in/out/percentage), fit-page and fit-width —
 * mirroring the complete-viewing experience of an office viewer, rather than
 * the previous per-page image strip.
 */
export function PdfViewerPanel({
  file,
  sessionId,
  worktreeId,
  onError,
}: PdfViewerPanelProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [scale, setScale] = React.useState<number>(1)
  const [fit, setFit] = React.useState<'none' | 'width' | 'page'>('none')
  const viewerRef = React.useRef<PDFViewer | null>(null)
  const linkServiceRef = React.useRef<PDFLinkService | null>(null)
  const eventBusRef = React.useRef<EventBus | null>(null)
  // True once the container element is mounted into the DOM. The PDFViewer is
  // only created after this, because it requires a live container element.
  const [containerReady, setContainerReady] = React.useState<boolean>(false)

  // Callback ref: set containerReady as soon as the container mounts.
  const setContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node
    setContainerReady(node !== null)
  }, [])

  // Initialize PDFViewer once the container is mounted.
  React.useEffect(() => {
    if (!containerReady || containerRef.current === null) return
    const eventBus = new EventBus()
    const linkService = new PDFLinkService({ eventBus })
    // pdfjs PDFViewer requires `container` and an inner `viewer` div, both with
    // tagName DIV; it falls back to container.firstElementChild otherwise. The
    // container must also be absolutely positioned. Create the inner viewer
    // element and pass it explicitly.
    const host = containerRef.current
    const viewerEl = document.createElement('div')
    viewerEl.className = 'pdfViewer'
    host.appendChild(viewerEl)
    const viewer = new PDFViewer({
      container: host,
      viewer: viewerEl,
      eventBus,
      linkService,
    })
    viewerRef.current = viewer
    linkServiceRef.current = linkService
    eventBusRef.current = eventBus
    linkService.setViewer(viewer)
    viewer.currentScaleValue = 'page-width'

    const updatePage = (evt: unknown) => {
      const pageNumber = (evt as { pageNumber?: number })?.pageNumber
      if (typeof pageNumber === 'number') setCurrentPage(pageNumber)
    }
    const updateScale = () => {
      if (viewer.currentScale) setScale(viewer.currentScale)
    }
    eventBus.on('pagechanging', updatePage)
    eventBus.on('scalechanging', updateScale)
    return () => {
      eventBus.off('pagechanging', updatePage)
      eventBus.off('scalechanging', updateScale)
      if (viewerEl.parentNode === host) host.removeChild(viewerEl)
      viewerRef.current = null
      linkServiceRef.current = null
      eventBusRef.current = null
    }
  }, [containerReady])

  // Load the PDF when the source changes AND the viewer is initialized.
  React.useEffect(() => {
    if (!containerReady) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const bytes = await fetchPdfBytes(file, sessionId, worktreeId)
        const task = pdfjsLib.getDocument({ data: bytes })
        const doc = await task.promise
        if (cancelled) {
          void task.destroy()
          return
        }
        const viewer = viewerRef.current
        const linkService = linkServiceRef.current
        if (viewer === null || linkService === null) {
          void task.destroy()
          return
        }
        linkService.setDocument(doc)
        viewer.setDocument(doc)
        setPageCount(doc.numPages)
        setCurrentPage(1)
        setScale(1)
        setFit('width')
        viewer.currentScaleValue = 'page-width'
      } catch (err) {
        if (!cancelled) {
          console.error('[PDF-MAKER] viewer load error:', err)
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
  }, [containerReady, file, sessionId, worktreeId])

  const viewer = viewerRef.current

  const zoomIn = () => {
    if (viewer === null) return
    viewer.currentScaleValue = String(Number((viewer.currentScale * 1.2).toFixed(2)))
    setFit('none')
    if (viewer.currentScale) setScale(viewer.currentScale)
  }
  const zoomOut = () => {
    if (viewer === null) return
    viewer.currentScaleValue = String(Number((viewer.currentScale / 1.2).toFixed(2)))
    setFit('none')
    if (viewer.currentScale) setScale(viewer.currentScale)
  }
  const applyFit = (mode: 'width' | 'page') => {
    if (viewer === null) return
    viewer.currentScaleValue = mode === 'page' ? 'page-fit' : 'page-width'
    setFit(mode)
    if (viewer.currentScale) setScale(viewer.currentScale)
  }
  const goToPage = (page: number) => {
    if (viewer === null) return
    const target = Math.max(1, Math.min(pageCount, page))
    // Use currentPageLabel: in scroll mode currentPageNumber is derived from
    // scroll position and doesn't navigate; currentPageLabel triggers a scroll.
    viewer.currentPageLabel = String(target)
    setCurrentPage(target)
  }

  const zoomPct = Math.round(scale * 100)

  return React.createElement(
    'div',
    { className: 'pdf-viewer-panel' },
    React.createElement(
      'div',
      { className: 'pdf-viewer-toolbar' },
      React.createElement(ToolButton, { label: '上一页', disabled: currentPage <= 1 || loading, onClick: () => goToPage(currentPage - 1), children: '‹' }),
      React.createElement(
        'span',
        { className: 'pdf-viewer-pageinfo' },
        `${currentPage} / ${pageCount}`,
      ),
      React.createElement(ToolButton, { label: '下一页', disabled: currentPage >= pageCount || loading, onClick: () => goToPage(currentPage + 1), children: '›' }),
      React.createElement(
        'span',
        { className: 'pdf-viewer-sep' },
        '',
      ),
      React.createElement(ToolButton, { label: '缩小', disabled: loading, onClick: zoomOut, children: '−' }),
      React.createElement(
        'span',
        { className: 'pdf-viewer-zoom' },
        `${zoomPct}%`,
      ),
      React.createElement(ToolButton, { label: '放大', disabled: loading, onClick: zoomIn, children: '+' }),
      React.createElement(ToolButton, { label: '适配宽度', active: fit === 'width', disabled: loading, onClick: () => applyFit('width'), children: '适配宽度' }),
      React.createElement(ToolButton, { label: '适配页面', active: fit === 'page', disabled: loading, onClick: () => applyFit('page'), children: '适配页面' }),
    ),
    React.createElement(
      'div',
      { className: 'pdf-viewer-body' },
      React.createElement(
        'div',
        { className: 'pdf-viewer-scroll' },
        React.createElement('div', { ref: setContainerRef, className: 'pdfjs-viewer-host' }),
      ),
      loading
        ? React.createElement('div', { className: 'pdf-viewer-overlay' }, '⏳ 正在加载 PDF…')
        : error !== null
          ? React.createElement(
              'div',
              { className: 'pdf-viewer-overlay pdf-viewer-error' },
              React.createElement('div', null, '⚠️ PDF 加载失败'),
              React.createElement('div', { className: 'pdf-viewer-error-msg' }, error),
            )
          : null,
    ),
  )
}

interface ToolButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: ToolButtonProps): React.ReactElement {
  return React.createElement(
    'button',
    {
      type: 'button',
      className: `pdf-viewer-tool${active ? ' pdf-viewer-tool-active' : ''}`,
      title: label,
      'aria-label': label,
      disabled,
      onClick,
    },
    children,
  )
}
