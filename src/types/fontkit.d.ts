/** Minimal ambient types for fontkit (the package ships no declarations). */

declare module 'fontkit' {
  export interface Font {
    readonly postscriptName: string | null
    readonly fullName: string | null
    layout(text: string): { glyphs: readonly { id: number }[] }
    glyphForCodePoint(codePoint: number): { id: number } | null
  }

  export interface FontCollection {
    readonly type: 'TTC'
    readonly fonts: Font[]
    readonly header: { readonly offsets: readonly number[] }
  }

  export function openSync(path: string): Font | FontCollection
  export function create(buffer: Uint8Array): Font | FontCollection
}
