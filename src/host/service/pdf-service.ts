import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import type { PdfServiceMethods } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    pdf: PdfService
  }
}

/** Service Definition for all Host-side PDF operations. */
export abstract class PdfService extends Service implements PdfServiceMethods {
  constructor(ctx: Context) {
    super(ctx, 'pdf')
  }

  abstract gatewayStatus(): ReturnType<PdfServiceMethods['gatewayStatus']>
  abstract ensureGateway(): ReturnType<PdfServiceMethods['ensureGateway']>
  abstract fileState(
    ...args: Parameters<PdfServiceMethods['fileState']>
  ): ReturnType<PdfServiceMethods['fileState']>
  abstract newFile(
    ...args: Parameters<PdfServiceMethods['newFile']>
  ): ReturnType<PdfServiceMethods['newFile']>
  abstract status(
    ...args: Parameters<PdfServiceMethods['status']>
  ): ReturnType<PdfServiceMethods['status']>
  abstract worktree(
    ...args: Parameters<PdfServiceMethods['worktree']>
  ): ReturnType<PdfServiceMethods['worktree']>
  abstract edit(
    ...args: Parameters<PdfServiceMethods['edit']>
  ): ReturnType<PdfServiceMethods['edit']>
  abstract exportPdf(
    ...args: Parameters<PdfServiceMethods['exportPdf']>
  ): ReturnType<PdfServiceMethods['exportPdf']>
  abstract screenshot(
    ...args: Parameters<PdfServiceMethods['screenshot']>
  ): ReturnType<PdfServiceMethods['screenshot']>
}
