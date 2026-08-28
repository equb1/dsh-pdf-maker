import { pdfError } from '../../service/errors.ts'
import { GatewayProcess } from './gateway-process.ts'

/**
 * Lifecycle supervisor for the bundled Gateway subprocess. Only one Gateway is
 * kept per plugin instance; concurrent `ensure` calls share one start promise.
 */
export class GatewaySupervisor {
  private gateway: GatewayProcess | null = null
  private starting: Promise<GatewayProcess> | null = null
  private startAttempted = false

  constructor(
    private readonly config: {
      gatewayPort: number
      autoStart: boolean
      startupTimeoutMs: number
    },
  ) {}

  get isRunning(): boolean {
    return this.gateway?.state === 'running'
  }

  get origin(): string | null {
    return this.gateway?.state === 'running' ? this.gateway.originValue : null
  }

  /** Start the Gateway on demand, sharing one in-flight start promise. */
  async ensure(): Promise<{ origin: string; alreadyRunning: boolean }> {
    const running = this.gateway
    if (running !== null && running.state === 'running') {
      return { origin: running.originValue, alreadyRunning: true }
    }
    if (this.starting === null) {
      this.starting = this.startWithRetry().catch((error) => {
        this.starting = null
        this.startAttempted = true
        throw error
      })
    }
    const gateway = await this.starting
    this.gateway = gateway
    this.starting = null
    return { origin: gateway.originValue, alreadyRunning: false }
  }

  async status() {
    if (this.gateway?.state === 'running') {
      return {
        state: 'running' as const,
        origin: this.gateway.originValue,
        message: null,
      }
    }
    if (this.starting !== null) {
      return {
        state: 'starting' as const,
        origin: null,
        message: 'gateway is starting',
      }
    }
    return {
      state: this.startAttempted ? ('failed' as const) : ('stopped' as const),
      origin: null,
      message: this.startAttempted
        ? 'last gateway start failed'
        : 'gateway is not started',
    }
  }

  /** Release the Gateway process when the owning plugin fiber ends. */
  async dispose(): Promise<void> {
    if (this.gateway !== null) await this.gateway.stop()
    this.gateway = null
    this.starting = null
  }

  private async startWithRetry(): Promise<GatewayProcess> {
    const maxPortSkips = 5
    let lastError: unknown = new Error('gateway start skipped')
    for (let offset = 0; offset < maxPortSkips; offset += 1) {
      const port = this.config.gatewayPort + offset
      try {
        return await GatewayProcess.start(port, this.config.startupTimeoutMs)
      } catch (error) {
        lastError = error
      }
    }
    throw pdfError(
      'gateway failed to start on any candidate port',
      'PDF_OPERATION_FAILED',
      { cause: lastError },
    )
  }
}
