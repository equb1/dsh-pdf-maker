/**
 * Minimal mirror of src/host/provider/cjk-font.ts: embed a system CJK font
 * (subset) into a pdf-lib document so Chinese form/text values render.
 */
import { existsSync, readFileSync } from 'node:fs'
import * as fontkit from 'fontkit'

const CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  'C:/Windows/Fonts/msyh.ttf',
  'C:/Windows/Fonts/simhei.ttf',
  '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
]

export async function fontkitEmbed(doc) {
  const path = CANDIDATES.find((p) => existsSync(p))
  if (!path) throw new Error('FONT_UNAVAILABLE: no system CJK font found')
  const bytes = readFileSync(path)
  doc.registerFontkit(fontkit)
  return doc.embedFont(bytes, { subset: true })
}
