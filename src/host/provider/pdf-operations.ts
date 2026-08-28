import { readFile, writeFile } from 'node:fs/promises'
import {
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  type PDFFont,
  PDFRadioGroup,
  PDFTextField,
  rgb,
  StandardFonts,
} from 'pdf-lib'
import type { PdfFormFieldInfo, PdfPageInfo } from '../../shared/wire/state.ts'
import { pdfError } from '../service/errors.ts'
import type { PdfEditCommand } from '../service/types.ts'
import { embedCjkFont, hasNonLatinText } from './cjk-font.ts'

export interface DocumentInspection {
  readonly pageCount: number
  readonly pages: PdfPageInfo[]
  readonly formFields: PdfFormFieldInfo[]
}

/** Apply a batch of structured edits to the draft copy of a PDF. */
export async function applyEdits(
  draft: string,
  edits: readonly PdfEditCommand[],
): Promise<{ pageCount: number }> {
  const source = await readFile(draft)
  const document = await loadDocument(source)

  let formNeedsCjk = false
  const form = document.getForm()

  for (const edit of edits) {
    if (edit.kind === 'form_create') {
      if (edit.page < 1 || edit.page > document.getPageCount()) {
        throw pdfError(
          `page ${edit.page} out of range (1..${document.getPageCount()})`,
          'INVALID_REQUEST',
        )
      }
      const page = document.getPage(edit.page - 1)
      const field = form.createTextField(edit.fieldName)

      const style = edit.style ?? 'underline'
      if (style === 'underline') {
        field.addToPage(page, {
          x: edit.x,
          y: edit.y,
          width: edit.width,
          height: edit.height,
          borderWidth: 0,
        })
        page.drawLine({
          start: { x: edit.x, y: edit.y },
          end: { x: edit.x + edit.width, y: edit.y },
          thickness: 0.75,
          color: rgb(0.65, 0.65, 0.65),
        })
      } else if (style === 'light') {
        field.addToPage(page, {
          x: edit.x,
          y: edit.y,
          width: edit.width,
          height: edit.height,
          borderWidth: 0.75,
          borderColor: rgb(0.8, 0.83, 0.88),
          backgroundColor: rgb(0.97, 0.98, 1.0),
        })
      } else {
        // borderless
        field.addToPage(page, {
          x: edit.x,
          y: edit.y,
          width: edit.width,
          height: edit.height,
          borderWidth: 0,
        })
      }

      if (typeof edit.fontSize === 'number' && edit.fontSize > 0) {
        field.setFontSize(edit.fontSize)
      }

      if (edit.defaultValue !== undefined && edit.defaultValue.length > 0) {
        if (hasNonLatinText(edit.defaultValue)) formNeedsCjk = true
        field.setText(edit.defaultValue)
      }
    } else if (edit.kind === 'form') {
      if (hasNonLatinText(edit.value)) formNeedsCjk = true
      let field: PDFTextField | undefined
      try {
        field = form.getTextField(edit.fieldName)
      } catch {
        const available = form
          .getFields()
          .map((f) => `"${f.getName()}"`)
          .join(', ')
        throw pdfError(
          `form field "${edit.fieldName}" not found. Available fields: [${available}]`,
          'PDF_OPERATION_FAILED',
        )
      }
      if (field === undefined) {
        throw pdfError(
          `form field "${edit.fieldName}" was not found on page ${edit.page}`,
          'PDF_OPERATION_FAILED',
        )
      }
      if (typeof edit.fontSize === 'number' && edit.fontSize > 0) {
        field.setFontSize(edit.fontSize)
      }
      field.setText(edit.value)
    } else if (edit.kind === 'text') {
      await drawText(document, edit)
    } else if (edit.kind === 'line') {
      if (edit.page < 1 || edit.page > document.getPageCount()) {
        throw pdfError(
          `page ${edit.page} out of range (1..${document.getPageCount()})`,
          'INVALID_REQUEST',
        )
      }
      const page = document.getPage(edit.page - 1)
      page.drawLine({
        start: { x: edit.x1, y: edit.y1 },
        end: { x: edit.x2, y: edit.y2 },
        thickness: edit.thickness ?? 1,
        color: rgbColor(edit.color),
      })
    }
  }

  const hasFormEdits = edits.some(
    (e) => e.kind === 'form' || e.kind === 'form_create',
  )
  if (hasFormEdits) {
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

/** Extract full metadata: page dimensions, interactive AcroForm fields. */
export async function inspectDocument(
  source: Uint8Array,
): Promise<DocumentInspection> {
  const document = await loadDocument(source)
  const pageCount = document.getPageCount()
  const pages: PdfPageInfo[] = []
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.getPage(index)
    pages.push({
      page: index + 1,
      width: Math.round(page.getWidth() * 100) / 100,
      height: Math.round(page.getHeight() * 100) / 100,
    })
  }

  const formFields: PdfFormFieldInfo[] = []
  try {
    const form = document.getForm()
    const fields = form.getFields()
    for (const field of fields) {
      let type: PdfFormFieldInfo['type'] = 'unknown'
      if (field instanceof PDFTextField) type = 'text'
      else if (field instanceof PDFCheckBox) type = 'checkbox'
      else if (field instanceof PDFDropdown) type = 'dropdown'
      else if (field instanceof PDFRadioGroup) type = 'radio'
      else if (field instanceof PDFButton) type = 'button'

      let value: string | undefined
      if (field instanceof PDFTextField) {
        value = field.getText() ?? ''
      }

      let rect: PdfFormFieldInfo['rect'] | undefined
      const widgets = field.acroField.getWidgets()
      if (widgets.length > 0) {
        const widget = widgets[0]
        if (widget !== undefined) {
          const r = widget.getRectangle()
          rect = {
            x: Math.round(r.x * 100) / 100,
            y: Math.round(r.y * 100) / 100,
            width: Math.round(r.width * 100) / 100,
            height: Math.round(r.height * 100) / 100,
          }
        }
      }

      formFields.push({
        name: field.getName(),
        type,
        ...(rect !== undefined ? { rect } : {}),
        ...(value !== undefined ? { value } : {}),
        readOnly: field.isReadOnly(),
      })
    }
  } catch {
    // Form may not exist
  }

  return { pageCount, pages, formFields }
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
  if (edit.page < 1 || edit.page > document.getPageCount()) {
    throw pdfError(
      `page ${edit.page} out of range (1..${document.getPageCount()})`,
      'INVALID_REQUEST',
    )
  }
  const page = document.getPage(edit.page - 1)
  const font = await pickFont(document, edit.text)
  const size = edit.size ?? 12
  page.drawText(edit.text, {
    x: edit.x,
    y: edit.y,
    size,
    font,
    color: rgbColor(edit.color),
    maxWidth: Math.max(10, page.getWidth() - edit.x - 24),
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
