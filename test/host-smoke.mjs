// Host smoke test: exercises worktree creation, status, edit, and merge against
// a scratch PDF using the plugin's core operations directly (no DSH runtime).
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as fontkit from 'fontkit'
import { PDFDocument } from 'pdf-lib'

const root = await mkdtemp(join(tmpdir(), 'dsh-pdf-maker-'))
const file = join(root, 'sample.pdf')
const workspace = root
try {
  const document = await PDFDocument.create()
  document.addPage()
  const bytes = await document.save()
  await writeFile(file, bytes)

  const { createWorktree, listWorktrees, requireDraft, applyReviewAction } =
    await import('../src/host/provider/worktree-operations.ts')
  const { applyEdits } = await import('../src/host/provider/pdf-operations.ts')

  const draft = await createWorktree(workspace, file, 'review')
  assert(draft.lifecycle === 'draft', 'draft lifecycle')

  const worktrees = await listWorktrees(workspace, file)
  assert(worktrees.length === 1, 'one worktree listed')
  assert(worktrees[0]?.worktreeId === draft.worktreeId, 'worktree id matches')

  const draftPath = await requireDraft(workspace, file, draft.worktreeId)
  const { pageCount } = await applyEdits(draftPath, [
    { kind: 'text', page: 1, x: 50, y: 50, text: 'hello' },
  ])
  assert(pageCount === 1, 'page count preserved')

  const ready = await applyReviewAction(
    workspace,
    file,
    draft.worktreeId,
    'ready',
  )
  assert(ready.lifecycle === 'ready', 'ready lifecycle')

  const merged = await applyReviewAction(
    workspace,
    file,
    draft.worktreeId,
    'merge',
  )
  assert(merged.lifecycle === 'merged', 'merged lifecycle')

  const trunk = await PDFDocument.load(await readFile(file))
  assert(trunk.getPageCount() === 1, 'merged trunk is a valid PDF')

  await runCjkScenario()
  console.log('host smoke ok')
} finally {
  await rm(root, { recursive: true, force: true })
}

/** Chinese + formula writing must succeed via system CJK font embedding. */
async function runCjkScenario() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-pdf-maker-cjk-'))
  try {
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const cjk = await readFile(
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    )
    const font = await doc.embedFont(cjk, { subset: true })
    const page = doc.addPage()
    page.drawText('合同标题 SAMPLE', { x: 60, y: 780, size: 18, font })
    const field = doc.getForm().createTextField('signer')
    field.addToPage(page, { x: 60, y: 700, width: 250, height: 30 })
    const source = await doc.save({ useObjectStreams: false })

    const draft = join(dir, 'draft.pdf')
    await writeFile(draft, source)
    const { applyEdits } = await import(
      '../src/host/provider/pdf-operations.ts'
    )
    const { pageCount } = await applyEdits(draft, [
      { kind: 'form', page: 1, fieldName: 'signer', value: '张三' },
      {
        kind: 'text',
        page: 1,
        x: 60,
        y: 640,
        text: '备注：公式 x² + y² = 25，日期 2026-08-28',
        size: 12,
      },
    ])
    assert(pageCount === 1, 'cjk page count')
    const reloaded = await PDFDocument.load(await readFile(draft))
    assert(reloaded.getPageCount() === 1, 'cjk reload')
    const filled = reloaded.getForm().getTextField('signer')
    assert(filled !== undefined, 'cjk field exists')
    assert(filled.getText() === '张三', 'cjk field value survives')
    assert(
      reloaded.context.enumerateIndirectObjects().length > 3,
      'cjk embedded objects present',
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}
