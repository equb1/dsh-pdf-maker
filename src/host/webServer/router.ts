import type { IncomingMessage, ServerResponse } from 'node:http'
import { SessionId, type SessionStore } from '@deepseek-ai/dsh-session'
import type { WorktreeReviewAction } from '../../shared/wire/actions.ts'
import { PdfError, pdfError } from '../service/errors.ts'
import { worktreeId } from '../service/identifiers.ts'
import type { PdfService } from '../service/pdf-service.ts'

const MAX_BODY_BYTES = 64 * 1024

const BROWSER_SAFE_CODES = new Set([
  'INVALID_REQUEST',
  'INVALID_FILE_PATH',
  'FILE_PERMISSION_DENIED',
  'FILE_NOT_FOUND',
  'SESSION_SCOPE_UNAVAILABLE',
  'SESSION_SCOPE_DENIED',
  'WORKTREE_NOT_FOUND',
])

/** Create the `/pdf-api` HTTP dispatcher. */
export function createPdfRouter(service: PdfService, sessions: SessionStore) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (
        request.method === 'GET' &&
        url.pathname === '/pdf-api/pdf.worker.mjs'
      ) {
        await workerRoute(response)
        return
      }
      if (request.method === 'GET' && url.pathname === '/pdf-api/status') {
        sendJson(response, 200, await statusRoute(service))
        return
      }
      if (request.method === 'GET' && url.pathname === '/pdf-api/state') {
        sendJson(
          response,
          200,
          await stateRoute(
            service,
            sessions,
            url.searchParams.get('file'),
            url.searchParams.get('sessionId'),
          ),
        )
        return
      }
      if (request.method === 'GET' && url.pathname === '/pdf-api/content') {
        await contentRoute(
          response,
          sessions,
          url.searchParams.get('file'),
          url.searchParams.get('sessionId'),
          url.searchParams.get('worktreeId'),
        )
        return
      }
      if (
        request.method === 'POST' &&
        url.pathname === '/pdf-api/worktree-action'
      ) {
        sendJson(
          response,
          200,
          await worktreeActionRoute(
            service,
            sessions,
            await readJsonBody(request),
          ),
        )
        return
      }
      if (request.method === 'POST' && url.pathname === '/pdf-api/edit') {
        sendJson(
          response,
          200,
          await editRoute(service, sessions, await readJsonBody(request)),
        )
        return
      }
      response.writeHead(404)
      response.end()
    } catch (error) {
      const forbidden =
        error instanceof PdfError &&
        (error.code === 'FILE_PERMISSION_DENIED' ||
          error.code === 'SESSION_SCOPE_DENIED')
      const rejected =
        error instanceof PdfError && BROWSER_SAFE_CODES.has(error.code)
      sendJson(response, rejected ? (forbidden ? 403 : 400) : 500, {
        ok: false,
        code: error instanceof PdfError ? error.code : 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/** Send a JSON response with no browser cache. */
export function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

async function statusRoute(service: PdfService) {
  return {
    version: '0.1.0',
    gateway: await service.gatewayStatus(),
    engines: { edit: true, render: false },
  }
}

/** Serve the bundled pdfjs worker (ESM) from lib/pdf.worker.mjs. */
async function workerRoute(response: ServerResponse): Promise<void> {
  const { readFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const workerPath = fileURLToPath(
    new URL('./pdf.worker.mjs', import.meta.url),
  )
  const bytes = await readFile(workerPath)
  response.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    'content-length': bytes.length,
    'cache-control': 'no-cache, no-store',
  })
  response.end(bytes)
}

async function stateRoute(
  service: PdfService,
  sessions: SessionStore,
  file: unknown,
  sessionId: unknown,
) {
  const scope = await resolveAuthorizedPdf(file, sessionId, sessions)
  return service.fileState({ workspace: scope.workspace, file: scope.path })
}

async function contentRoute(
  response: ServerResponse,
  sessions: SessionStore,
  file: unknown,
  sessionId: unknown,
  worktreeIdValue: unknown,
) {
  const scope = await resolveAuthorizedPdf(file, sessionId, sessions)
  let targetPath: string = scope.path
  if (typeof worktreeIdValue === 'string' && worktreeIdValue.length > 0) {
    const { requireDraft } = await import('../provider/worktree-operations.ts')
    targetPath = await requireDraft(
      scope.workspace,
      scope.path,
      worktreeId(worktreeIdValue),
    )
  }
  const { readFile } = await import('node:fs/promises')
  const { basename } = await import('node:path')
  const bytes = await readFile(targetPath)
  response.writeHead(200, {
    'content-type': 'application/pdf',
    'content-length': bytes.length,
    'content-disposition': `inline; filename="${basename(targetPath)}"`,
    'cache-control': 'no-cache, no-store, must-revalidate',
    'accept-ranges': 'bytes',
  })
  response.end(bytes)
}

async function worktreeActionRoute(
  service: PdfService,
  sessions: SessionStore,
  body: unknown,
) {
  const record = body as Record<string, unknown>
  const scope = await resolveAuthorizedPdf(
    record.file,
    record.sessionId,
    sessions,
  )
  const action = record.action
  if (
    typeof action !== 'string' ||
    !['ready', 'reopen', 'merge', 'discard'].includes(action)
  ) {
    throw pdfError(
      'action must be ready, reopen, merge, or discard',
      'INVALID_REQUEST',
    )
  }
  const worktreeIdValue = record.worktreeId
  if (typeof worktreeIdValue !== 'string' || worktreeIdValue.length === 0) {
    throw pdfError('worktreeId is required', 'INVALID_REQUEST')
  }
  return service.worktree(
    {
      workspace: scope.workspace,
      file: scope.path,
      action: action as WorktreeReviewAction,
      worktreeId: worktreeId(worktreeIdValue),
    },
    undefined,
  )
}

async function editRoute(
  service: PdfService,
  sessions: SessionStore,
  body: unknown,
) {
  if (typeof body !== 'object' || body === null) {
    throw pdfError('request body must be a JSON object', 'INVALID_REQUEST')
  }
  const record = body as Record<string, unknown>
  const scope = await resolveAuthorizedPdf(
    record.file,
    record.sessionId,
    sessions,
  )
  const worktreeIdValue = record.worktreeId
  if (typeof worktreeIdValue !== 'string' || worktreeIdValue.length === 0) {
    throw pdfError('worktreeId is required', 'INVALID_REQUEST')
  }
  if (!Array.isArray(record.edits)) {
    throw pdfError('edits array is required', 'INVALID_REQUEST')
  }
  return service.edit({
    workspace: scope.workspace,
    file: scope.path,
    worktreeId: worktreeId(worktreeIdValue),
    edits: record.edits as import('../service/types.ts').PdfEditCommand[],
  })
}

async function resolveAuthorizedPdf(
  file: unknown,
  sessionId: unknown,
  sessions: SessionStore,
) {
  if (typeof file !== 'string' || file.length === 0)
    throw pdfError('file is required', 'INVALID_REQUEST')
  if (typeof sessionId !== 'string' || sessionId.length === 0)
    throw pdfError('sessionId is required', 'INVALID_REQUEST')
  const cwd = sessions.get(SessionId(sessionId))?.header.cwd
  if (cwd === undefined)
    throw pdfError(
      'session is unavailable or has no workspace',
      'SESSION_SCOPE_UNAVAILABLE',
    )
  return resolvePdfPathFrom(cwd, file)
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > MAX_BODY_BYTES)
      throw pdfError('request body is too large', 'INVALID_REQUEST')
    chunks.push(buffer)
  }
  if (chunks.length === 0)
    throw pdfError('JSON body is required', 'INVALID_REQUEST')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch (error) {
    throw pdfError('request body must be valid JSON', 'INVALID_REQUEST', {
      cause: error,
    })
  }
}

async function resolvePdfPathFrom(cwd: string, value: string) {
  const { resolvePdfPath } = await import('../service/workspace.ts')
  return resolvePdfPath(cwd, value)
}
