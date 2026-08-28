import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config.ts'
import { GatewaySupervisor } from '../processes/gateway/supervisor.ts'
import { GatewayPdfService } from './gateway-pdf-service.ts'

/** Mount the PDF Service Provider and its bundled Gateway supervisor. */
export function apply(ctx: Context, config: ResolvedConfig): void {
  const supervisor = new GatewaySupervisor({
    gatewayPort: config.gatewayPort,
    autoStart: config.autoStartGateway,
    startupTimeoutMs: config.gatewayStartupTimeoutMs,
  })
  new GatewayPdfService(ctx, config, supervisor)
  ctx.effect(() => () => {
    void supervisor.dispose()
  })
}

export const name = 'pdf-provider'
