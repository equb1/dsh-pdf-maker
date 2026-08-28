import { copyFile, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config.ts'
import type { GatewaySupervisor } from '../processes/gateway/supervisor.ts'
import { pdfError } from '../service/errors.ts'
import type { WorktreeId } from '../service/identifiers.ts'
import { PdfService } from '../service/pdf-service.ts'
import type { PdfServiceMethods } from '../service/types.ts'
import {
  applyEdits,
  createEmptyPdf,
  inspectDocument,
} from './pdf-operations.ts'
import { renderScreenshot } from './render-operations.ts'
import {
  applyReviewAction,
  createWorktree,
  draftPath,
  listWorktrees,
  pageCountOf,
  requireDraft,
} from './worktree-operations.ts'

/** The one PDF Service implementation: composes worktrees, edits, and render. */
export class GatewayPdfService extends PdfService {
  constructor(
    ctx: Context,
    readonly _config: ResolvedConfig,
    private readonly supervisor: GatewaySupervisor,
  ) {
    super(ctx)
  }

  async gatewayStatus(): ReturnType<PdfServiceMethods['gatewayStatus']> {
    return this.supervisor.status()
  }

  async ensureGateway(): ReturnType<PdfServiceMethods['ensureGateway']> {
    return this.supervisor.ensure()
  }

  async fileState(
    request: Parameters<PdfServiceMethods['fileState']>[0],
  ): ReturnType<PdfServiceMethods['fileState']> {
    const info = await stat(request.file).catch(() => null)
    if (info === null)
      return {
        file: request.file,
        exists: false,
        pageCount: null,
        worktrees: [],
        gatewayOrigin: this.supervisor.origin,
      }
    const bytes = await readFile(request.file)
    const inspection = await inspectDocument(bytes).catch(() => null)
    return {
      file: request.file,
      exists: true,
      pageCount: inspection?.pageCount ?? (await pageCountOf(bytes)),
      ...(inspection?.pages !== undefined ? { pages: inspection.pages } : {}),
      ...(inspection?.formFields !== undefined
        ? { formFields: inspection.formFields }
        : {}),
      worktrees: await listWorktrees(request.workspace, request.file),
      gatewayOrigin: this.supervisor.origin,
    }
  }

  async newFile(
    request: Parameters<PdfServiceMethods['newFile']>[0],
  ): ReturnType<PdfServiceMethods['newFile']> {
    const existing = await stat(request.file).catch(() => null)
    if (existing !== null) {
      throw pdfError(
        'file already exists; pass a different .pdf target',
        'INVALID_FILE_PATH',
      )
    }
    await writeFile(request.file, await createEmptyPdf())
    return this.fileState(request)
  }

  async status(
    request: Parameters<PdfServiceMethods['status']>[0],
  ): ReturnType<PdfServiceMethods['status']> {
    const targetFile =
      request.worktreeId === undefined
        ? request.file
        : ((await requireDraft(
            request.workspace,
            request.file,
            request.worktreeId as WorktreeId,
          )) as unknown as Parameters<
            PdfServiceMethods['fileState']
          >[0]['file'])
    const state = await this.fileState({
      workspace: request.workspace,
      file: targetFile,
    })
    if (!state.exists)
      throw pdfError('file does not exist', 'INVALID_FILE_PATH')
    return {
      ...state,
      file: request.file,
      worktrees: await listWorktrees(request.workspace, request.file),
    }
  }

  async worktree(
    request: Parameters<PdfServiceMethods['worktree']>[0],
  ): ReturnType<PdfServiceMethods['worktree']> {
    if (request.action === 'create') {
      const state = await createWorktree(
        request.workspace,
        request.file,
        request.name,
      )
      return {
        worktreeId: state.worktreeId,
        action: 'create' as const,
        lifecycle: state.lifecycle,
        path: draftPath(
          request.workspace,
          request.file,
          state.worktreeId as WorktreeId,
        ),
      }
    }
    const id = request.worktreeId as WorktreeId
    const state = await applyReviewAction(
      request.workspace,
      request.file,
      id,
      request.action,
    )
    return {
      worktreeId: state.worktreeId,
      action: request.action,
      lifecycle: state.lifecycle,
      path: draftPath(request.workspace, request.file, id),
    }
  }

  async edit(
    request: Parameters<PdfServiceMethods['edit']>[0],
  ): ReturnType<PdfServiceMethods['edit']> {
    const id = request.worktreeId as WorktreeId
    const draft = await requireDraft(request.workspace, request.file, id)
    await applyEdits(draft, request.edits)
    const state = await applyReviewAction(
      request.workspace,
      request.file,
      id,
      'ready',
    )
    return {
      worktreeId: state.worktreeId,
      action: 'ready' as const,
      lifecycle: state.lifecycle,
      path: draft,
    }
  }

  async exportPdf(
    request: Parameters<PdfServiceMethods['exportPdf']>[0],
  ): ReturnType<PdfServiceMethods['exportPdf']> {
    const source =
      request.worktreeId === undefined
        ? request.file
        : await requireDraft(
            request.workspace,
            request.file,
            request.worktreeId as WorktreeId,
          )
    const output = resolve(request.outputWorkspace, request.output)
    await copyFile(source, output)
    return { output }
  }

  async screenshot(
    request: Parameters<PdfServiceMethods['screenshot']>[0],
    signal?: AbortSignal,
  ): ReturnType<PdfServiceMethods['screenshot']> {
    const draft =
      request.worktreeId === undefined
        ? request.file
        : await requireDraft(
            request.workspace,
            request.file,
            request.worktreeId as WorktreeId,
          )
    return renderScreenshot(request, draft, signal)
  }
}
