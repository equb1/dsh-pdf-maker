---
name: pdf
description: Create, inspect, edit, review, and deliver PDF files through DSH tools and isolated worktrees. Use proactively for any PDF task: form filling, text annotations, redaction, splitting, merging, exporting, or reviewing rendered pages.
---

# PDF editing workflow

PDF files are edited through **isolated draft worktrees**. Never edit a trunk file
directly; always create a draft, apply structured edits, ready it for review, and
let the user merge or discard.

## Core rules

1. **Never modify a PDF in place.** Call `pdf_worktree create`, then apply edits
   to the returned `worktreeId`.
2. **Structured edits only.** Use `pdf_edit` with form or text commands. Do not
   invent editing capabilities the tools do not expose.
3. **Merge and discard are user decisions.** Call `pdf_worktree merge` or
   `pdf_worktree discard` only after the user explicitly asks; the DSH approval
   flow will confirm the choice.
4. **Verify before delivering.** Call `pdf_status` to confirm the worktree
   lifecycle, and `pdf_screenshot` (when the render engine is available) to let
   the user see the result.

## Typical sequence

1. `pdf_status` on the target file to learn its trunk state and existing worktrees.
2. `pdf_worktree create` to open an isolated draft.
3. `pdf_edit` with `{ kind: 'form', fieldName, value }` or
   `{ kind: 'text', x, y, text }` commands on the draft.
4. `pdf_status` to confirm the draft is `ready`.
5. Export a copy with `pdf_export` when the user wants a standalone file.
6. After user approval, `pdf_worktree merge` (publish to trunk) or `discard`.

## Limitations

- PDF text cannot be reflowed: replacing text keeps the original layout, so keep
  replacement strings visually compatible (similar width) to avoid overlap.
- Chinese, Japanese, Korean, and math characters are supported when writing text
  or filling forms: the plugin discovers a system CJK font (macOS Arial Unicode,
  Windows 微软雅黑/黑体, Linux Noto) and embeds a subset automatically. If no
  system CJK font is found, editing returns `Error [FONT_UNAVAILABLE]`.
- Render/screenshot requires the render engine; until it is wired, report that
  `pdf_screenshot` is unavailable instead of guessing the page layout.
- Scanned (image-only) PDFs have no text layer; OCR is a planned capability.
