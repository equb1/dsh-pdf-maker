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
`
