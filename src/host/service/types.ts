import type {
  WorktreeActionResult,
  WorktreeReviewAction,
} from '../../shared/wire/actions.ts'
import type { FileState } from '../../shared/wire/state.ts'
import type {
  EnsureGatewayResult,
  GatewayStatus,
} from '../../shared/wire/status.ts'
import type { PdfFilePath, WorkspacePath, WorktreeId } from './identifiers.ts'

/** JSON values accepted across the model tool boundary. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

/** File request tied to one authorized workspace. */
export interface ScopedFileRequest {
  readonly workspace: WorkspacePath
  readonly file: PdfFilePath
}

/** Request for one file's collaboration state. */
export interface FileStateRequest extends ScopedFileRequest {}

/** Request for a model-readable file status projection. */
export interface FileStatusRequest extends ScopedFileRequest {
  readonly worktreeId?: WorktreeId
}

/** Request for creating a new empty PDF container. */
export interface NewPdfFileRequest extends ScopedFileRequest {}

/** Browser-initiated worktree lifecycle decision. */
export interface WorktreeActionRequest extends ScopedFileRequest {
  readonly action: WorktreeReviewAction
  readonly worktreeId: WorktreeId
}

/** Model-facing worktree lifecycle request. */
export type WorktreeOperationRequest = ScopedFileRequest &
  (
    | { readonly action: 'create'; readonly name?: string }
    | {
        readonly action: 'ready' | 'reopen' | 'merge' | 'discard'
        readonly worktreeId: WorktreeId
      }
  )

/** One structured edit applied to a draft worktree copy of the PDF. */
export type PdfEditCommand =
  | {
      readonly kind: 'form'
      readonly page: number
      readonly fieldName: string
      readonly value: string
      readonly fontSize?: number
    }
  | {
      readonly kind: 'form_create'
      readonly page: number
      readonly fieldName: string
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly style?: 'underline' | 'light' | 'borderless'
      readonly defaultValue?: string
      readonly fontSize?: number
    }
  | {
      readonly kind: 'text'
      readonly page: number
      readonly x: number
      readonly y: number
      readonly text: string
      readonly size?: number
      readonly color?: string
    }
  | {
      readonly kind: 'line'
      readonly page: number
      readonly x1: number
      readonly y1: number
      readonly x2: number
      readonly y2: number
      readonly thickness?: number
      readonly color?: string
    }

/** Model-facing edit request. */
export interface PdfEditRequest extends ScopedFileRequest {
  readonly worktreeId: WorktreeId
  readonly edits: readonly PdfEditCommand[]
}

/** Export the trunk or a worktree copy of a PDF to an authorized output path. */
export interface PdfExportRequest extends ScopedFileRequest {
  readonly output: string
  readonly outputWorkspace: WorkspacePath
  readonly worktreeId?: WorktreeId
}

/** Render selected pages of a PDF to PNG and return durable image attachments. */
export interface PdfScreenshotRequest extends ScopedFileRequest {
  readonly worktreeId?: WorktreeId
  readonly pages?: readonly number[]
  readonly scale?: number
}

/** One rendered page attachment. */
export type PdfScreenshotPage = {
  readonly page: number
  readonly attachmentId: string | null
  readonly imagePath: string
  readonly width: number
  readonly height: number
}

/** Result of a screenshot operation. */
export type PdfScreenshotResult = {
  readonly file: string
  readonly pages: PdfScreenshotPage[]
}

/** Methods implemented by the PDF service definition. */
export interface PdfServiceMethods {
  gatewayStatus(): Promise<GatewayStatus>
  ensureGateway(): Promise<EnsureGatewayResult>
  fileState(request: FileStateRequest, signal?: AbortSignal): Promise<FileState>
  newFile(request: NewPdfFileRequest, signal?: AbortSignal): Promise<FileState>
  status(request: FileStatusRequest, signal?: AbortSignal): Promise<FileState>
  worktree(
    request: WorktreeOperationRequest,
    signal?: AbortSignal,
  ): Promise<WorktreeActionResult>
  edit(
    request: PdfEditRequest,
    signal?: AbortSignal,
  ): Promise<WorktreeActionResult>
  exportPdf(
    request: PdfExportRequest,
    signal?: AbortSignal,
  ): Promise<{ output: string }>
  screenshot(
    request: PdfScreenshotRequest,
    signal?: AbortSignal,
  ): Promise<PdfScreenshotResult>
}
