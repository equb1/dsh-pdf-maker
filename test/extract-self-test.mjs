// Self-test: extract_pages keeps only selected pages.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { applyEdits } from '../src/host/provider/pdf-operations.ts'

const root = await mkdtemp(join(tmpdir(), 'extract-test-'))
const file = join(root, 'main.pdf')
try {
  const doc = await PDFDocument.create()
  for (let i = 1; i <= 5; i++) doc.addPage([300 + i, 300 + i]) // page i width 301+i
  await writeFile(file, await doc.save())

  const readSizes = async () => {
    const d = await PDFDocument.load(await readFile(file))
    return Array.from({ length: d.getPageCount() }, (_, i) =>
      Math.round(d.getPage(i).getSize().width),
    )
  }
  console.log('initial widths (page1..5):', await readSizes())

  // Extract pages 2 and 4 -> keep only those (drop 1,3,5).
  await applyEdits(file, [{ kind: 'extract_pages', pages: [2, 4] }])
  const after = await readSizes()
  console.log('after extract [2,4] widths:', after)
  const ok = after.join(',') === '302,304'
  console.log(ok ? 'PASS: kept only pages 2 and 4' : 'FAIL')
  if (!ok) process.exit(1)
} finally {
  await rm(root, { recursive: true, force: true })
}
