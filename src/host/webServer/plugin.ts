import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '../service/pdf-service.ts'
import { createPdfRouter } from './router.ts'

/** Services required by the browser API consumer. */
export const inject = ['pdf', 'webServer', 'sessions']
export const name = 'pdf-web'

/** Register the browser API as one host webserver prefix route. */
export function apply(ctx: Context): void {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/pdf-api',
        handler: createPdfRouter(ctx.pdf, ctx.sessions),
      }),
    'pdf: browser api',
  )
}
