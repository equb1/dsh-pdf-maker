import { createServer, type Server } from 'node:http'

/**
 * Bundled Gateway subprocess entry.
 *
 * Current stage: health check only. This process is the planned home of the
 * PDF Viewer (pdf.js) and the render/editor control plane, mirroring the
 * dsh-univer-office Gateway role. The Host supervisor spawns this with
 * `--port <n>` and waits for `/healthz`.
 */
const args = parseArgs(process.argv.slice(2))
const port = args.port ?? 9080

const server: Server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (request.method === 'GET' && url.pathname === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true, service: 'dsh-pdf-maker-gateway' }))
    return
  }
  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('dsh-pdf-maker gateway (viewer not yet wired)')
    return
  }
  response.writeHead(404)
  response.end()
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`dsh-pdf-maker gateway listening on 127.0.0.1:${port}\n`)
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}

function parseArgs(values: readonly string[]): { port: number | undefined } {
  let port: number | undefined
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--port') {
      const raw = values[index + 1]
      if (raw !== undefined) port = Number.parseInt(raw, 10)
    }
  }
  return { port }
}
