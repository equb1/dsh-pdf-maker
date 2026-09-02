/** Modern stylesheet injected by the PDF client bundle for preview cards. */
export const worktreeStyles = `
[data-plugin="dsh-pdf-maker"] .pdf-preview-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  margin: 8px 0;
  background: var(--bg-card, rgba(255, 255, 255, 0.85));
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  font-family: inherit;
  transition: all 0.2s ease;
}

[data-plugin="dsh-pdf-maker"] .pdf-preview-card:hover {
  border-color: var(--border-hover, #cbd5e1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.07);
}

[data-plugin="dsh-pdf-maker"] .pdf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

[data-plugin="dsh-pdf-maker"] .pdf-file-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary, #0f172a);
}

[data-plugin="dsh-pdf-maker"] .pdf-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

[data-plugin="dsh-pdf-maker"] .pdf-badge-draft {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

[data-plugin="dsh-pdf-maker"] .pdf-badge-ready {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

[data-plugin="dsh-pdf-maker"] .pdf-badge-merged {
  background: #f5f3ff;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
}

[data-plugin="dsh-pdf-maker"] .pdf-badge-discarded {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-container {
  position: relative;
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #e2e8f0);
  background: #f8fafc;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #f8fafc;
}

[data-plugin="dsh-pdf-maker"] .pdf-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle, #f1f5f9);
}

[data-plugin="dsh-pdf-maker"] .pdf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-primary {
  background: #0284c7;
  color: #ffffff;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-primary:hover {
  background: #0369a1;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-success {
  background: #059669;
  color: #ffffff;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-success:hover {
  background: #047857;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-secondary {
  background: #ffffff;
  color: #475569;
  border-color: #cbd5e1;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-secondary:hover {
  background: #f8fafc;
  color: #1e293b;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-danger {
  background: #ffffff;
  color: #e11d48;
  border-color: #fecdd3;
}

[data-plugin="dsh-pdf-maker"] .pdf-btn-danger:hover {
  background: #fff1f2;
}

[data-plugin="dsh-pdf-maker"] .pdf-operations-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

[data-plugin="dsh-pdf-maker"] .pdf-op-tag {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

[data-plugin="dsh-pdf-maker"] .pdf-toolbox {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 4px;
}

[data-plugin="dsh-pdf-maker"] .pdf-toolbox-tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}

[data-plugin="dsh-pdf-maker"] .pdf-tab-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: #64748b;
  transition: all 0.15s ease;
}

[data-plugin="dsh-pdf-maker"] .pdf-tab-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

[data-plugin="dsh-pdf-maker"] .pdf-tab-btn.active {
  background: #ffffff;
  color: #0284c7;
  border-color: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

[data-plugin="dsh-pdf-maker"] .pdf-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

[data-plugin="dsh-pdf-maker"] .pdf-text-input {
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 12px;
  background: #ffffff;
  color: #0f172a;
  outline: none;
}

[data-plugin="dsh-pdf-maker"] .pdf-text-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 1px #0284c7;
}

[data-plugin="dsh-pdf-maker"] .pdf-select {
  padding: 5px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 12px;
  background: #ffffff;
  color: #0f172a;
}

/* ---- Fullscreen "separate window" preview overlay ---- */
[data-plugin="dsh-pdf-maker"] .pdf-fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 9990;
  background: var(--dsw-alias-bg-base, #0f172a);
  display: flex;
  flex-direction: column;
  padding: 0;
}

[data-plugin="dsh-pdf-maker"] .pdf-fullscreen-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #1e293b;
  color: #f1f5f9;
  border-bottom: 1px solid #334155;
}

[data-plugin="dsh-pdf-maker"] .pdf-fullscreen-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-plugin="dsh-pdf-maker"] .pdf-fullscreen-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
  align-items: center;
}

[data-plugin="dsh-pdf-maker"] .pdf-fullscreen-body .pdf-viewer-iframe {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
}
/* ---- Full pdfjs PDFViewer panel ---- */
[data-plugin="dsh-pdf-maker"] .pdf-viewer-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  z-index: 5;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-tool {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  cursor: pointer;
  min-width: 30px;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-tool:hover:not(:disabled) {
  background: #f1f5f9;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-tool-active {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-pageinfo {
  font-size: 13px;
  color: #0f172a;
  min-width: 56px;
  text-align: center;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-zoom {
  font-size: 13px;
  color: #0f172a;
  min-width: 44px;
  text-align: center;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-sep {
  width: 1px;
  height: 20px;
  background: #e2e8f0;
  margin: 0 2px;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 13px;
  padding: 20px;
  gap: 8px;
  background: #f1f3f7;
  z-index: 3;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-error {
  color: #e11d48;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-error-msg {
  color: #64748b;
  font-size: 12px;
  word-break: break-word;
  max-width: 480px;
}

[data-plugin="dsh-pdf-maker"] .pdf-viewer-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #f1f3f7;
}

[data-plugin="dsh-pdf-maker"] .pdfjs-viewer-host {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
}

[data-plugin="dsh-pdf-maker"] .pdfjs-viewer-host .pdfViewer {
  min-height: 100%;
  padding: 12px;
}

[data-plugin="dsh-pdf-maker"] .pdf-fullscreen-body .pdf-viewer-panel {
  height: 100%;
}

/* ---- Two-mode PDF preview (thumbnails + full) ---- */
[data-plugin="dsh-pdf-maker"] .pdf-preview {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

[data-plugin="dsh-pdf-maker"] .pdf-preview-modes {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

[data-plugin="dsh-pdf-maker"] .pdf-preview-mode {
  padding: 5px 14px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
}

[data-plugin="dsh-pdf-maker"] .pdf-preview-mode:hover {
  background: #f1f5f9;
}

[data-plugin="dsh-pdf-maker"] .pdf-preview-mode-active {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
}

/* Thumbnail grid */
[data-plugin="dsh-pdf-maker"] .pdf-thumb-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  background: #f1f3f7;
  position: relative;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-hint {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 10px;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-card {
  width: 150px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.1s ease, border-color 0.1s ease;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-card:hover {
  border-color: #94a3b8;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-card.is-dragging {
  opacity: 0.5;
  border-color: #0284c7;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
  cursor: grabbing;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-num {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-ghost {
  position: fixed;
  z-index: 9999;
  transform: translate(-50%, -110%);
  padding: 8px 12px;
  background: #0284c7;
  color: #ffffff;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
  box-shadow: 0 8px 20px rgba(2, 132, 199, 0.35);
  white-space: nowrap;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-status {
  flex: 1;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 13px;
  padding: 20px;
  min-height: 200px;
  gap: 8px;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-error {
  color: #e11d48;
}

[data-plugin="dsh-pdf-maker"] .pdf-thumb-error-msg {
  color: #64748b;
  font-size: 12px;
  word-break: break-word;
  max-width: 480px;
}

[data-plugin="dsh-pdf-maker"] .pdf-fullscreen-body .pdf-preview {
  height: 100%;
}

/* ---- Batch tools panel ---- */
[data-plugin="dsh-pdf-maker"] .pdf-batch {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 4px;
}

[data-plugin="dsh-pdf-maker"] .pdf-batch-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

[data-plugin="dsh-pdf-maker"] .pdf-batch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

[data-plugin="dsh-pdf-maker"] .pdf-batch-desc {
  font-size: 12px;
  color: #475569;
  flex: 1;
  min-width: 160px;
}

[data-plugin="dsh-pdf-maker"] .pdf-batch-input {
  min-width: 200px;
  flex: 1;
}

[data-plugin="dsh-pdf-maker"] .pdf-batch-input-small {
  width: 110px;
}

[data-plugin="dsh-pdf-maker"] .pdf-batch-status {
  font-size: 12px;
  color: #0284c7;
}
`