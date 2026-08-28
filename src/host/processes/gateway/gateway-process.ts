import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Handle for one spawned bundled Gateway process. */
export class GatewayProcess {
  private readonly child: ReturnType<typeof spawn>
  private readonly origin: string
  private exited = false
  private exitInfo: {
    code: number | null
    signal: NodeJS.Signals | null
  } | null = null

  private constructor(child: ReturnType<typeof spawn>, origin: string) {
    this.child = child
    this.origin = origin
    child.once('exit', (code, signal) => {
      this.exited = true
      this.exitInfo = { code, signal }
    })
  }

  get state(): 'running' | 'failed' {
    return this.exited ? 'failed' : 'running'
  }

  get originValue(): string {
    return this.origin
  }

  get exit(): { code: number | null; signal: NodeJS.Signals | null } | null {
    return this.exitInfo
  }

  /** Spawn the bundled Gateway on a specific port and wait for its health check. */
  static async start(port: number, timeoutMs: number): Promise<GatewayProcess> {
    const gatewayPath = resolveGatewayPath()
    const child = spawn(
      process.execPath,
      [gatewayPath, '--port', String(port)],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 4096) stderr = stderr.slice(-4096)
    })
    const origin = `http://127.0.0.1:${port}`
    const gateway = new GatewayProcess(child, origin)

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (gateway.state === 'failed') {
        throw new Error(
          `gateway exited during startup${stderr.length > 0 ? `: ${stderr.trim()}` : ''}`,
        )
      }
      if (await isHealthy(origin)) return gateway
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 100))
    }
    child.kill('SIGTERM')
    throw new Error(`gateway did not become healthy within ${timeoutMs}ms`)
  }

  /** Terminate the child process. */
  async stop(): Promise<void> {
    if (this.exited) return
    this.child.kill('SIGTERM')
    await Promise.race([
      once(this.child, 'exit'),
      new Promise((resolveSleep) => setTimeout(resolveSleep, 2_000)),
    ])
    if (!this.exited) this.child.kill('SIGKILL')
  }
}

function resolveGatewayPath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', '..', '..', 'artifacts', 'gateway.cjs')
}

async function isHealthy(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin}/healthz`)
    return response.ok
  } catch {
    return false
  }
}
