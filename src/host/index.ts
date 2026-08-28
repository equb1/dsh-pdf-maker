import type { Context } from '@deepseek-ai/cordis'
import type { Config as PdfConfig } from './config.ts'
import { resolveConfig } from './config.ts'
import * as provider from './provider/plugin.ts'
import * as skills from './skills/plugin.ts'
import * as tools from './tools/plugin.ts'
import * as webServer from './webServer/plugin.ts'

export * from '../shared/wire/actions.ts'
export * from '../shared/wire/state.ts'
export * from '../shared/wire/status.ts'
export { Config, resolveConfig } from './config.ts'
export { GatewayPdfService } from './provider/gateway-pdf-service.ts'
export { PdfService } from './service/pdf-service.ts'
export { createPdfRouter } from './webServer/router.ts'
export type { PdfConfig }

export const name = 'dsh-pdf-maker'

/** Compose the PDF Provider and its Web/Tools/Skills consumers. */
export function apply(ctx: Context, config: PdfConfig = {}): void {
  const resolved = resolveConfig(config)
  ctx.plugin(provider, resolved)
  ctx.plugin(webServer)
  if (resolved.tools) ctx.plugin(tools)
  if (resolved.skills) ctx.plugin(skills)
}
