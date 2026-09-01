---
name: pdf
description: Create, inspect, edit, review, organize, watermark, split, merge, and deliver PDF files through DSH tools and isolated worktrees. Use proactively for any PDF task: form filling, text annotations, interactive form creation, page reordering/rotating/deletion, watermark, page numbering, splitting, merging, exporting, or reviewing rendered pages.
---

# PDF Editing & Organizing Workflow

PDF files are edited through **isolated draft worktrees**. Never edit a trunk file
directly; always inspect the layout first, create a draft, apply structured edits,
and let the user merge or discard through the in-session review card.

## Core Rules

1. **Always inspect first with `pdf_status`.** Call `pdf_status` on the target file
   to discover its page dimensions (`pages`), existing interactive AcroForm fields
   (`formFields`), and draft worktrees. Never guess field names or coordinates blindly.
2. **Never modify a PDF in place.** Call `pdf_worktree create` to open an isolated
   draft, then apply all edits to the returned `worktreeId`.
3. **Choose the right structured edit command:**
   - **Filling existing form fields:** If `pdf_status` shows existing `formFields`,
     use `{ kind: 'form', page, fieldName, value, fontSize? }`.
   - **Creating new interactive form fields:** If adding fillable inputs to a contract
     or form, use `{ kind: 'form_create', page, fieldName, x, y, width, height, style: 'underline' | 'light' | 'borderless', defaultValue?, fontSize? }`.
   - **Page Reordering:** Use `{ kind: 'reorder_pages', order: [3, 1, 2, 4] }` to resequence pages.
   - **Page Deletion:** Use `{ kind: 'delete_pages', pages: [2, 5] }` to remove specified pages.
   - **Page Rotation:** Use `{ kind: 'rotate_pages', pages?: [1], degrees: 90 | 180 | 270 | -90 }` to rotate pages.
   - **Page Insertion:** Use `{ kind: 'insert_pages', sourceFile: 'appendix.pdf', sourcePages?: [1, 2], atPage?: 3 }`.
   - **Watermarking:** Use `{ kind: 'watermark', text: '内部机密', opacity: 0.18, rotation: 45, fontSize: 36, color: '#64748B' }`.
   - **Page Numbering:** Use `{ kind: 'page_number', format: '第 {page} 页 / 共 {total} 页', position: 'bottom_center' }`.
   - **Flatten Forms:** Use `{ kind: 'flatten' }` to bake fillable fields into non-editable static content.
   - **Metadata:** Use `{ kind: 'metadata', title: '合同终审', author: '法务部' }`.
   - **Direct text / signing / annotations:** Use `{ kind: 'text', page, x, y, text, size?, color? }`.
   - **Decorative or structure lines:** Use `{ kind: 'line', page, x1, y1, x2, y2, thickness?, color? }`.
4. **Master the PDF Coordinate System:**
   - The origin `(0, 0)` is at the **bottom-left** corner of the page.
   - Standard A4 portrait is `595.28 pt` wide and `841.89 pt` high.
   - Top margin starts around `y = 780..800`; bottom margin ends around `y = 50..80`.
   - For `text`, `y` is the **text baseline** (the line text sits on).
   - For `form_create`, `(x, y)` is the **bottom-left corner** of the field box.
5. **Merge and discard are user decisions.** Call `pdf_worktree merge` or
   `pdf_worktree discard` only after the user explicitly approves in chat.
6. **Live Turn-Tail Preview Card:** The DSH Client automatically renders an interactive,
   high-definition PDF preview viewer card with full zoom, scroll, and Merge/Discard buttons
   at the tail of every turn. Do NOT call `pdf_screenshot` or attempt to generate PNG thumbnails,
   as the live card already provides superior real-time interactive preview.

## Standard Sequences

### 1. Form Filling & Annotation
`pdf_status` $\rightarrow$ `pdf_worktree create` $\rightarrow$ `pdf_edit` (form + text) $\rightarrow$ `pdf_worktree ready` $\rightarrow$ Live Preview Card renders in chat $\rightarrow$ User Confirm.

### 2. Page Organizing & Reordering
`pdf_status` $\rightarrow$ `pdf_worktree create` $\rightarrow$ `pdf_edit` (`reorder_pages` / `delete_pages` / `rotate_pages`) $\rightarrow$ `pdf_worktree ready` $\rightarrow$ Live Preview Card renders in chat.

### 3. Multi-Step Iterative Editing
If the user requests further modifications after seeing the preview, continue calling `pdf_edit` on the **same `worktreeId`**. The live preview card will automatically refresh with the latest draft!

### 4. Official Document Stamping & Watermarking
`pdf_worktree create` $\rightarrow$ `pdf_edit` (`watermark` + `page_number` + `flatten`) $\rightarrow$ `pdf_worktree ready`.

## Form Field Style Guide

- **`underline` (Recommended for Contracts & Legal Forms):**
  Transparent fill and border with a subtle 0.75pt bottom underline.
- **`light` (Recommended for Application Forms & Surveys):**
  Subtle light-blue/grey border (`#CCD4E0`) with very light background (`#F8FAFC`).
- **`borderless`:**
  Completely invisible field until focused by the user in a PDF reader.

## Font & Character Support

- Chinese, Japanese, Korean (CJK) characters and math symbols are automatically
  encoded using system CJK font embedding (subsetting via fontkit).
- If no system CJK font is found, operations return `Error [FONT_UNAVAILABLE]`.
