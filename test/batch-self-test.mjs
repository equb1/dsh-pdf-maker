// Self-test for the new batch commands: split_pages (A3->2x A4) and merge_pages.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { applyEdits } from '../src/host/provider/pdf-operations.ts'

const root = await mkdtemp(join(tmpdir(), 'dsh-pdf-maker-batch-'))
const file = join(root, 'main.pdf')
const source = join(root, 'extra.pdf')
const workspace = root

let failures = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok - ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL - ${name}: ${detail}`)
  }
}

try {
  // main.pdf: 2 pages of A3 size (1190.55 x 841.89) so split makes sense.
  const doc = await PDFDocument.create()
  doc.addPage([1190.55, 841.89]) // page1
  doc.addPage([841.89, 1190.55]) // page2 (A3 portrait)
  const mainBytes = await doc.save()
  await writeFile(file, mainBytes)

  // extra.pdf: 1 A4 page, to be merged.
  const extra = await PDFDocument.create()
  extra.addPage([595.28, 841.89])
  const extraBytes = await extra.save()
  await writeFile(source, extraBytes)

  // ---- split_pages: split page 1 vertically (left/right) -> 3 pages total
  let { pageCount: c1 } = await applyEdits(file, [
    { kind: 'split_pages', pages: [1], direction: 'vertical' },
  ])
  check('split_pages vertical: 2->3 pages', c1 === 3, `got ${c1}`)

  // Read back page 1 of the split result and confirm width is halved.
  const splitBytes = await readFile(file)
  const splitDoc = await PDFDocument.load(splitBytes)
  const p1 = splitDoc.getPage(0).getMediaBox()
  check(
    'split vertical halves page width',
    Math.abs(p1.width - 1190.55 / 2) < 1,
    `width=${p1.width}`,
  )

  // ---- split_pages horizontal on the (now) 3rd page
  let { pageCount: c2 } = await applyEdits(file, [
    { kind: 'split_pages', pages: [3], direction: 'horizontal' },
  ])
  check('split_pages horizontal: 3->4 pages', c2 === 4, `got ${c2}`)

  // ---- merge_pages: append extra.pdf (1 page) -> 4->5 pages
  let { pageCount: c3 } = await applyEdits(file, [
    { kind: 'merge_pages', sources: [source] },
  ])
  check('merge_pages appends: 4->5 pages', c3 === 5, `got ${c3}`)

  // ---- merge_pages atPage: insert at position 2 -> 6 pages
  let { pageCount: c4 } = await applyEdits(file, [
    { kind: 'merge_pages', sources: [source], atPage: 2 },
  ])
  check('merge_pages atPage 2: 5->6 pages', c4 === 6, `got ${c4}`)
} catch (err) {
  failures += 1
  console.error('EXCEPTION:', err && err.message)
} finally {
  await rm(root, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll batch command self-tests passed.')
