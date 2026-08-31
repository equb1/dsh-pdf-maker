/**
 * Drive the plugin's provider operations (the exact code path behind
 * pdf_status / pdf_worktree / pdf_edit) to edit demo/source/contract.pdf:
 *   inspect -> create draft worktree -> fill/create form fields -> red review
 *   annotation -> mark ready, then render before/after previews.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = `${import.meta.dirname}/..`
const FILE = join(ROOT, 'demo/source/contract.pdf')
const WORKSPACE = join(ROOT) // trunk dir; provider stores drafts under workspace/.dsh-pdf-maker/worktrees

const { inspectDocument } = await import(
  join(ROOT, 'src/host/provider/pdf-operations.ts')
)
const { applyEdits } = await import(
  join(ROOT, 'src/host/provider/pdf-operations.ts')
)
const { createWorktree, applyReviewAction } = await import(
  join(ROOT, 'src/host/provider/worktree-operations.ts')
)

const step = (m) => console.log(`\n— ${m}`)

// 1. pdf_status-equivalent
step('1. pdf_status → 检查页面与表单域')
const sourceBytes = await readFile(FILE)
const inspected = await inspectDocument(sourceBytes)
console.log('   pageCount:', inspected.pageCount)
console.log('   pages:', JSON.stringify(inspected.pages))
console.log('   formFields:')
for (const f of inspected.formFields) {
  console.log(
    `     - ${f.name} [${f.type}] value=${JSON.stringify(f.value)} rect=${JSON.stringify(f.rect)} readOnly=${f.readOnly}`,
  )
}

// 2. pdf_worktree create-equivalent
step('2. pdf_worktree create → 隔离草稿')
const draft = await createWorktree(WORKSPACE, FILE, '编辑合同-H T2026')
console.log(
  '   worktreeId:',
  draft.worktreeId,
  '| lifecycle:',
  draft.lifecycle,
  '| pageCount:',
  draft.pageCount,
)

// 3. pdf_edit-equivalent
step('3. pdf_edit → 表单填写 + 红色审核批注')
const draftPath = join(
  WORKSPACE,
  '.dsh-pdf-maker/worktrees/contract.pdf',
  draft.worktreeId,
  'contract.pdf',
)

// Determine existing fields so we only create missing ones.
const existing = new Set(inspected.formFields.map((f) => f.name))
const edits = []

if (existing.has('contract_no')) {
  edits.push({
    kind: 'form',
    page: 1,
    fieldName: 'contract_no',
    value: 'HT-2026-8899',
    fontSize: 10,
  })
} else {
  edits.push({
    kind: 'form_create',
    page: 1,
    fieldName: 'contract_no',
    x: 470,
    y: 769,
    width: 110,
    height: 22,
    style: 'underline',
    defaultValue: 'HT-2026-8899',
    fontSize: 10,
  })
}
if (existing.has('signer')) {
  edits.push({
    kind: 'form',
    page: 1,
    fieldName: 'signer',
    value: '李四',
    fontSize: 12,
  })
} else {
  edits.push({
    kind: 'form_create',
    page: 1,
    fieldName: 'signer',
    x: 130,
    y: 311,
    width: 180,
    height: 22,
    style: 'underline',
    defaultValue: '李四',
    fontSize: 12,
  })
}
if (existing.has('sign_date')) {
  edits.push({
    kind: 'form',
    page: 1,
    fieldName: 'sign_date',
    value: '2026-08-28',
    fontSize: 12,
  })
} else {
  edits.push({
    kind: 'form_create',
    page: 1,
    fieldName: 'sign_date',
    x: 370,
    y: 311,
    width: 150,
    height: 22,
    style: 'underline',
    defaultValue: '2026-08-28',
    fontSize: 12,
  })
}

// Red review annotation near the bottom (avoid overlapping body clauses).
edits.push({
  kind: 'text',
  page: 1,
  x: 70,
  y: 120,
  text: '【法务审核】条款合规，同意签署',
  size: 11,
  color: '#E00000',
})

const { pageCount } = await applyEdits(draftPath, edits)
console.log('   edits applied:', edits.length, '| pageCount:', pageCount)
console.log('   draftPath:', draftPath)

// 4. pdf_status on draft to confirm filled values
step('4. pdf_status → 校验草稿')
const draftBytes = await readFile(draftPath)
const after = await inspectDocument(draftBytes)
console.log('   pageCount:', after.pageCount)
console.log('   formFields:')
for (const f of after.formFields) {
  console.log(`     - ${f.name} [${f.type}] value=${JSON.stringify(f.value)}`)
}

// 5. ready
step('5. pdf_worktree ready')
const ready = await applyReviewAction(
  WORKSPACE,
  FILE,
  draft.worktreeId,
  'ready',
)
console.log('   lifecycle:', ready.lifecycle)

// 6. Render before/after for the review card
step('6. 渲染 before/after 预览')
const RENDER_DIR = join(ROOT, 'demo/render')
await mkdir(RENDER_DIR, { recursive: true })
await renderPng(sourceBytes, join(RENDER_DIR, 'task-before.png'))
await renderPng(draftBytes, join(RENDER_DIR, 'task-after.png'))
console.log('   rendered task-before.png / task-after.png')
console.log('   draftPath:', draftPath)

async function renderPng(data, outPath) {
  const { createCanvas } = await import(
    '/tmp/pdfdemo-render/node_modules/@napi-rs/canvas/index.js'
  )
  const canvasM = await import(
    '/tmp/pdfdemo-render/node_modules/@napi-rs/canvas/index.js'
  )
  globalThis.DOMMatrix = canvasM.DOMMatrix
  globalThis.DOMPoint = canvasM.DOMPoint
  globalThis.DOMRect = canvasM.DOMRect
  globalThis.Path2D = canvasM.Path2D
  globalThis.ImageData = canvasM.ImageData
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const dataArr = Buffer.isBuffer(data) ? new Uint8Array(data) : data
  const doc = await getDocument({ data: dataArr }).promise
  const page = await doc.getPage(1)
  const vp = page.getViewport({ scale: 2 })
  const cnv = createCanvas(vp.width, vp.height)
  const ctx = cnv.getContext('2d')
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  await writeFile(outPath, cnv.toBuffer('image/png'))
}
