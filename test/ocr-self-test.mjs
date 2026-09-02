// OCR self-test with detailed diagnostics.
import { mkdtemp, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runOcr } from '../src/host/provider/ocr-operations.ts'

const root = await mkdtemp(join(tmpdir(), 'ocr-test-'))
const file = join(root, 'sample-report.pdf')
try {
  await copyFile('sample-report.pdf', file)
  console.log('copied pdf, calling runOcr...')
  const result = await runOcr(
    { file, workspace: root, pages: [1], lang: 'chi_sim' },
    file,
  )
  console.log('runOcr returned pages:', result.pages.length)
  const p = result.pages[0]
  console.log('text:', JSON.stringify(p?.text ?? ''))
  console.log('confidence:', p?.confidence)
  if (p && p.text && p.text.length > 0) {
    console.log('PASS')
  } else {
    console.error('FAIL: empty text')
    process.exit(1)
  }
} catch (e) {
  console.error('FAIL:', e && e.message)
  console.error('STACK:', e && e.stack)
  process.exit(1)
} finally {
  await rm(root, { recursive: true, force: true })
}
