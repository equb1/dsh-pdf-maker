---
name: pdf
description: Create, inspect, edit, review, and deliver PDF files through DSH tools and isolated worktrees. Use proactively for any PDF task: form filling, text annotations, interactive form creation, splitting, merging, exporting, or reviewing rendered pages.
---

# PDF Editing Workflow

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
     Prefer `style: 'underline'` (draws an elegant contract underline) or `style: 'light'`
     (subtle soft border) over ugly heavy black boxes.
   - **Direct text / signing / annotations:** Use `{ kind: 'text', page, x, y, text, size?, color? }`.
   - **Decorative or structure lines:** Use `{ kind: 'line', page, x1, y1, x2, y2, thickness?, color? }`.
4. **Master the PDF Coordinate System:**
   - The origin `(0, 0)` is at the **bottom-left** corner of the page.
   - Standard A4 portrait is `595.28 pt` wide and `841.89 pt` high.
   - Top margin starts around `y = 780..800`; bottom margin ends around `y = 50..80`.
   - For `text`, `y` is the **text baseline** (the line text sits on).
   - For `form_create`, `(x, y)` is the **bottom-left corner** of the field box.
   - When placing a form field next to a label `签署人：` at `(x: 70, y: 350)` with font size 12,
     place the form field at `(x: 130, y: 346, width: 140, height: 20)` so text baselines align.
5. **Merge and discard are user decisions.** Call `pdf_worktree merge` or
   `pdf_worktree discard` only after the user explicitly approves in chat.

## Standard Sequence

1. `pdf_status` → get page dimensions and list of `formFields`.
2. `pdf_worktree create` → create isolated draft copy.
3. `pdf_edit` → apply structured `form`, `form_create`, `text`, or `line` commands.
4. `pdf_status` → verify draft state is `ready` and review inspected fields.
5. `pdf_export` → export a copy when the user requests a standalone output file.
6. Await user confirmation → `pdf_worktree merge` (publish to trunk) or `discard`.

## Form Field Style Guide

- **`underline` (Recommended for Contracts & Legal Forms):**
  Transparent fill and border with a subtle 0.75pt bottom underline. Text typed
  into the field sits naturally on the line without abrupt rectangular boxes.
- **`light` (Recommended for Application Forms & Surveys):**
  Subtle light-blue/grey border (`#CCD4E0`) with very light background (`#F8FAFC`).
- **`borderless`:**
  Completely invisible field until focused by the user in a PDF reader.

## Font & Character Support

- Chinese, Japanese, Korean (CJK) characters and math symbols are automatically
  encoded using system CJK font embedding (subsetting via fontkit).
- If no system CJK font is found, operations return `Error [FONT_UNAVAILABLE]`.
