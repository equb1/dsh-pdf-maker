/**
 * End-to-end PDF editing demo for dsh-pdf-maker.
 *
 * Mirrors the plugin's own tool flow (pdf_status → pdf_worktree create →
 * pdf_edit → pdf_status → ready → review → merge/discard) using the exact
 * engines the plugin uses: pdf-lib for editing, fontkit for CJK subset
 * embedding, pdfjs-dist (+ canvas) for page rendering. The pdf_* Cordis tools
 * are not exposed as agent tools in this session, so we drive the underlying
 * provider operations directly.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { fontkitEmbed } from './helpers/fontkit-embed.mjs'

const DEMO = import.meta.dirname
const SOURCE_DIR = join(DEMO, 'source')
const WORKTREE_ROOT = join(DEMO, 'worktrees', 'contract')
const RENDER_DIR = join(DEMO, 'render')
const SLUG = 'contract.pdf'

/** Phase 0 — create a realistic sample contract with AcroForm text fields. */
async function generateSource() {
  await mkdir(SOURCE_DIR, { recursive: true })
  const out = join(SOURCE_DIR, SLUG)
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4 portrait
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const cjk = await fontkitEmbed(doc)

  const H = 841.89
  const title = '服 务 合 同'
  const tw = cjk.widthOfTextAtSize(title, 22)
  page.drawText(title, { x: (595.28 - tw) / 2, y: H - 80, size: 22, font: cjk })
  page.drawText('合同编号：', { x: 400, y: H - 60, size: 10, font: cjk })

  const body = [
    '甲方（委托方）：示例科技有限公司',
    '乙方（服务方）：示例数据服务有限公司',
    '',
    '一、服务内容：乙方为甲方提供数据采集与标注服务。',
    '二、服务期限：自 2024 年 9 月 1 日起至 2025 年 8 月 31 日止。',
    '三、费用与结算：服务费按月度结算，甲方应在收到乙方发票后 15 日内支付。',
    '四、保密条款：双方对本合同内容负有保密义务，未经对方书面同意不得披露。',
    '五、违约责任：任何一方违约，应赔偿对方因此遭受的直接损失。',
    '六、争议解决：因本合同引起的争议，双方协商不成的，提交甲方所在地法院裁决。',
  ]
  let y = H - 150
  for (const line of body) {
    if (line.length > 0) {
      page.drawText(line, { x: 70, y, size: 11, font: cjk, lineHeight: 16 })
    }
    y -= 22
  }

  const form = doc.getForm()
  const mkUnderlineField = (name, x, y, w = 140, h = 20) => {
    const f = form.createTextField(name)
    f.setText('')
    f.addToPage(page, { x, y, width: w, height: h, borderWidth: 0 })
    page.drawLine({
      start: { x, y },
      end: { x: x + w, y },
      thickness: 0.75,
      color: rgb(0.65, 0.65, 0.65),
    })
    f.enableReadOnly(false)
    f.setFontSize(11)
    return f
  }

  // 右上角：合同编号
  mkUnderlineField('contract_no', 455, H - 64, 110, 18)

  // 底部签署区：标签与下划线输入框水平对齐
  page.drawText('签署人：', { x: 70, y: H - 480, size: 12, font: cjk })
  mkUnderlineField('signer', 130, H - 484, 140, 20)

  page.drawText('日期：', { x: 320, y: H - 480, size: 12, font: cjk })
  mkUnderlineField('sign_date', 365, H - 484, 120, 20)

  const bytes = await doc.save({ useObjectStreams: false })
  await writeFile(out, bytes)
  return bytes
}

/** Phase 1 — isolate a draft worktree (mirror pdf_worktree create). */
async function createWorktree(sourceBytes) {
  const id = randomUUID().slice(0, 8)
  const dir = join(WORKTREE_ROOT, id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, SLUG), sourceBytes)
  await writeFile(join(dir, 'meta.json'), JSON.stringify({ name: 'demo-编辑合同', lifecycle: 'draft', createdAt: Date.now() }))
  return { id, dir }
}

/** Phase 2 — apply structured edits (mirror pdf_edit form + text commands). */
async function applyEdits(draftPath) {
  const source = await readFile(draftPath)
  const doc = await PDFDocument.load(source, { ignoreEncryption: true })
  const cjk = await fontkitEmbed(doc)
  const form = doc.getForm()

  // form commands
  for (const [field, value] of [
    ['contract_no', 'HT-2024-0012'],
    ['signer', '张三'],
    ['sign_date', '2024-08-28'],
  ]) {
    const f = form.getTextField(field)
    if (f === undefined) throw new Error(`field "${field}" not found`)
    f.setText(value)
  }
  form.updateFieldAppearances(cjk)

  // text command — reviewer annotation on the signature block
  const page = doc.getPage(0)
  const note = '【审核意见】签署人信息已核验，条款四、五确认无误，可签署。'
  page.drawText(note, { x: 70, y: 150, size: 10, font: cjk, color: rgb(0.8, 0, 0) })

  const bytes = await doc.save({ useObjectStreams: false, updateFieldAppearances: false })
  await writeFile(draftPath, bytes)
}

/** Phase 3 — ready for review + render page 1 (mirror pdf_screenshot). */
async function readyAndRender(draftPath) {
  await mkdir(RENDER_DIR, { recursive: true })
  const before = await readFile(join(SOURCE_DIR, SLUG))
  const after = await readFile(draftPath)
  await renderPng(before, join(RENDER_DIR, 'before.png'))
  await renderPng(after, join(RENDER_DIR, 'after.png'))
}

async function renderPng(data, outPath) {
  const { createCanvas } = await import('/tmp/pdfdemo-render/node_modules/@napi-rs/canvas/index.js')
  const canvasM = await import('/tmp/pdfdemo-render/node_modules/@napi-rs/canvas/index.js')
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

// ---- run ----
const step = (msg) => console.log(`\n— ${msg}`)
step('1. pdf_new / 生成示例合同 source.pdf')
const sourceBytes = await generateSource()
console.log('   已生成:', join(SOURCE_DIR, SLUG))

step('2. pdf_worktree create → 隔离草稿')
const { id, dir } = await createWorktree(sourceBytes)
const draft = join(dir, SLUG)
console.log('   worktreeId:', id)
console.log('   draft copy:', draft)

step('3. pdf_edit → 表单填写 + 文字标注')
await applyEdits(draft)
console.log('   form: contract_no=HT-2024-0012, signer=张三, sign_date=2024-08-28')
console.log('   text: 审核意见标注 @ (70,150)')

step('4. pdf_status → ready + pdf_screenshot 渲染对比')
const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'))
meta.lifecycle = 'ready'
await writeFile(join(dir, 'meta.json'), JSON.stringify(meta))
await readyAndRender(draft)
console.log('   lifecycle: draft → ready')
console.log('   rendered:  demo/render/before.png  (原 PDF 第 1 页)')
console.log('   rendered:  demo/render/after.png   (草稿 第 1 页)')

console.log('\n=== 演示完成：草稿已 ready，等待审阅 merge / discard ===')
