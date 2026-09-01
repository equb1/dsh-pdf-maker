import { readFile, writeFile } from 'node:fs/promises'
import {
  degrees,
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
  let document = await loadDocument(source)

  let formNeedsCjk = false
  let form = document.getForm()

  for (const edit of edits) {
    if (edit.kind === 'reorder_pages') {
      const pageCount = document.getPageCount()
      const newDoc = await PDFDocument.create()
      const indices = edit.order.map((p) => {
        if (p < 1 || p > pageCount) {
          throw pdfError(
            `page ${p} out of range (1..${pageCount})`,
            'INVALID_REQUEST',
          )
        }
        return p - 1
      })
      const copiedPages = await newDoc.copyPages(document, indices)
      for (const cp of copiedPages) {
        newDoc.addPage(cp)
      }
      document = newDoc
      form = document.getForm()
      continue
    }

    if (edit.kind === 'delete_pages') {
      const toDelete = [...new Set(edit.pages)].sort((a, b) => b - a)
      for (const p of toDelete) {
        if (p < 1 || p > document.getPageCount()) {
          throw pdfError(
            `page ${p} out of range (1..${document.getPageCount()})`,
            'INVALID_REQUEST',
          )
        }
        if (document.getPageCount() <= 1) {
          throw pdfError(
            'cannot delete all pages from a PDF document',
            'INVALID_REQUEST',
          )
        }
        document.removePage(p - 1)
      }
      continue
    }

    if (edit.kind === 'rotate_pages') {
      const pageIndices =
        edit.pages !== undefined && edit.pages.length > 0
          ? edit.pages.map((p) => {
              if (p < 1 || p > document.getPageCount()) {
                throw pdfError(
                  `page ${p} out of range (1..${document.getPageCount()})`,
                  'INVALID_REQUEST',
                )
              }
              return p - 1
            })
          : Array.from({ length: document.getPageCount() }, (_, i) => i)

      for (const idx of pageIndices) {
        const page = document.getPage(idx)
        const current = page.getRotation().angle
        page.setRotation(degrees((current + edit.degrees + 360) % 360))
      }
      continue
    }

    if (edit.kind === 'insert_pages') {
      const srcBytes = await readFile(edit.sourceFile)
      const srcDoc = await loadDocument(srcBytes)
      const srcPageCount = srcDoc.getPageCount()
      const srcIndices =
        edit.sourcePages !== undefined && edit.sourcePages.length > 0
          ? edit.sourcePages.map((p) => {
              if (p < 1 || p > srcPageCount) {
                throw pdfError(
                  `source page ${p} out of range (1..${srcPageCount})`,
                  'INVALID_REQUEST',
                )
              }
              return p - 1
            })
          : Array.from({ length: srcPageCount }, (_, i) => i)

      const copied = await document.copyPages(srcDoc, srcIndices)
      let targetIndex =
        edit.atPage !== undefined ? edit.atPage : document.getPageCount()
      if (targetIndex < 0 || targetIndex > document.getPageCount()) {
        targetIndex = document.getPageCount()
      }
      for (const cp of copied) {
        document.insertPage(targetIndex, cp)
        targetIndex += 1
      }
      continue
    }

    if (edit.kind === 'watermark') {
      const font = await pickFont(document, edit.text)
      const rotationAngle = edit.rotation ?? 45
      const opacity = edit.opacity ?? 0.18
      const fontSize = edit.fontSize ?? 36
      const color = rgbColor(edit.color ?? '#64748B')
      const targetPages =
        edit.pages !== undefined && edit.pages.length > 0
          ? edit.pages.map((p) => p - 1)
          : Array.from({ length: document.getPageCount() }, (_, i) => i)

      for (const idx of targetPages) {
        if (idx < 0 || idx >= document.getPageCount()) continue
        const page = document.getPage(idx)
        const { width, height } = page.getSize()
        const textWidth = font.widthOfTextAtSize(edit.text, fontSize)
        const textHeight = font.heightAtSize(fontSize)
        page.drawText(edit.text, {
          x: (width - textWidth) / 2,
          y: (height - textHeight) / 2,
          size: fontSize,
          font,
          color,
          opacity,
          rotate: degrees(rotationAngle),
        })
      }
      continue
    }

    if (edit.kind === 'page_number') {
      const totalPages = document.getPageCount()
      const start = edit.startFrom ?? 1
      const fontSize = edit.fontSize ?? 10
      const color = rgbColor(edit.color ?? '#64748B')
      const position = edit.position ?? 'bottom_center'
      const formatPattern = edit.format ?? '第 {page} 页 / 共 {total} 页'

      const targetPages =
        edit.pages !== undefined && edit.pages.length > 0
          ? edit.pages.map((p) => p - 1)
          : Array.from({ length: totalPages }, (_, i) => i)

      for (const idx of targetPages) {
        if (idx < 0 || idx >= totalPages) continue
        const page = document.getPage(idx)
        const pageNum = start + idx
        const text = formatPattern
          .replace('{page}', String(pageNum))
          .replace('{total}', String(totalPages))
        const font = await pickFont(document, text)
        const textWidth = font.widthOfTextAtSize(text, fontSize)
        const { width, height } = page.getSize()

        let x = (width - textWidth) / 2
        let y = 25
        if (position === 'bottom_right') x = width - textWidth - 35
        else if (position === 'top_center') {
          x = (width - textWidth) / 2
          y = height - 30
        } else if (position === 'top_right') {
          x = width - textWidth - 35
          y = height - 30
        }

        page.drawText(text, { x, y, size: fontSize, font, color })
      }
      continue
    }

    if (edit.kind === 'flatten') {
      try {
        form.flatten()
      } catch {
        // ignore if form doesn't exist
      }
      continue
    }

    if (edit.kind === 'metadata') {
      if (edit.title) document.setTitle(edit.title)
      if (edit.author) document.setAuthor(edit.author)
      if (edit.subject) document.setSubject(edit.subject)
      if (edit.keywords) document.setKeywords([...edit.keywords])
      continue
    }

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
          borderColor: rgb(0.8, 0.82, 0.86),
          backgroundColor: rgb(0.98, 0.98, 0.99),
        })
      } else {
        field.addToPage(page, {
          x: edit.x,
          y: edit.y,
          width: edit.width,
          height: edit.height,
          borderWidth: 0,
        })
      }

      if (edit.fontSize !== undefined) {
        field.setFontSize(edit.fontSize)
      }
      if (edit.defaultValue !== undefined && edit.defaultValue.length > 0) {
        field.setText(edit.defaultValue)
        if (hasNonLatinText(edit.defaultValue)) {
          formNeedsCjk = true
        }
      }
      continue
    }

    if (edit.kind === 'form') {
      const field = form.getTextField(edit.fieldName)
      field.setText(edit.value)
      if (edit.fontSize !== undefined) {
        field.setFontSize(edit.fontSize)
      }
      if (hasNonLatinText(edit.value)) {
        formNeedsCjk = true
      }
      continue
    }

    if (edit.kind === 'line') {
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
      continue
    }

    if (edit.kind === 'text') {
      await drawText(document, edit)
    }
  }

  if (formNeedsCjk) {
    const cjkFont = await embedCjkFont(document)
    form.updateFieldAppearances(cjkFont)
  }

  const bytes = await document.save({ useObjectStreams: false })
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
