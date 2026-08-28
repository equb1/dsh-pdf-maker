import { readFile, writeFile } from 'node:fs/promises'
import { PDFDocument, type PDFFont, rgb, StandardFonts } from 'pdf-lib'
import { pdfError } from '../service/errors.ts'
import type { PdfEditCommand } from '../service/types.ts'
import { embedCjkFont, hasNonLatinText } from './cjk-font.ts'

/** Apply a batch of structured edits to the draft copy of a PDF. */
export async function applyEdits(
  draft: string,
  edits: readonly PdfEditCommand[],
): Promise<{ pageCount: number }> {
  const source = await readFile(draft)
  const document = await loadDocument(source)
  const formEdits = edits.filter(
    (edit): edit is Extract<PdfEditCommand, { kind: 'form' }> =>
      edit.kind === 'form',
  )
  const textEdits = edits.filter(
    (edit): edit is Extract<PdfEditCommand, { kind: 'text' }> =>
      edit.kind === 'text',
  )
  for (const edit of textEdits) {
    await drawText(document, edit)
  }
  let formNeedsCjk = false
  if (formEdits.length > 0) {
    const form = document.getForm()
    for (const edit of formEdits) {
      if (hasNonLatinText(edit.value)) formNeedsCjk = true
      const field = form.getTextField(edit.fieldName)
      if (field === undefined) {
        throw pdfError(
          `form field "${edit.fieldName}" was not found on page ${edit.page}`,
          'PDF_OPERATION_FAILED',
        )
      }
      // setText only writes the value; appearances are regenerated below with a
      // font that can encode the value (WinAnsi/CJK), so addToPage is not called.
      field.setText(edit.value)
    }
    form.updateFieldAppearances(
      formNeedsCjk ? await embedCjkFont(document) : undefined,
    )
  }
  const bytes = await document.save({
    useObjectStreams: false,
    updateFieldAppearances: false,
  })
  await writeFile(draft, bytes)
  return { pageCount: document.getPageCount() }
}

/** Create a new empty (single blank page) PDF container. */
export async function createEmptyPdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.addPage()
  return document.save({ useObjectStreams: false })
}

/** Load a PDF document or report a stable invalid-PDF error. */
export async function loadDocument(source: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(source, { ignoreEncryption: true })
  } catch (error) {
    throw pdfError('the file is not a readable PDF', 'PDF_INVALID', {
      cause: error,
    })
  }
}

async function pickFont(document: PDFDocument, text: string): Promise<PDFFont> {
  if (hasNonLatinText(text)) return embedCjkFont(document)
  return document.embedFont(StandardFonts.Helvetica)
}

async function drawText(
  document: PDFDocument,
  edit: Extract<PdfEditCommand, { kind: 'text' }>,
): Promise<void> {
  const page = document.getPage(edit.page - 1)
  const font = await pickFont(document, edit.text)
  const size = edit.size ?? 12
  page.drawText(edit.text, {
    x: edit.x,
    y: edit.y,
    size,
    font,
    color: rgbColor(edit.color),
    maxWidth: page.getWidth() - edit.x - 24,
    lineHeight: size * 1.25,
  })
}

function rgbColor(value: string | undefined) {
  if (value === undefined) return rgb(0, 0, 0)
  const hex = value.replace('#', '')
  const int = Number.parseInt(hex, 16)
  if (Number.isNaN(int) || hex.length !== 6) return rgb(0, 0, 0)
  return rgb(
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  )
}
