import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

export type PdfOperationName =
  | 'new'
  | 'status'
  | 'worktree'
  | 'edit'
  | 'export'
  | 'screenshot'
export type PdfOperationPhase = 'pending' | 'succeeded' | 'failed'
export type PdfTurnLifecycle =
  | 'trunk'
  | 'draft'
  | 'ready'
  | 'merged'
  | 'discarded'
  | 'unchanged'

/** One durable PDF tool operation recovered from a call/result pair. */
export interface PdfTurnOperation {
  readonly callId: string
  readonly name: PdfOperationName
  readonly action: string | null
  readonly file: string
  readonly worktreeId: string | null
  readonly phase: PdfOperationPhase
}

/** All PDF operations for one file in one Turn. */
export interface PdfTurnFile {
  readonly file: string
  readonly operations: readonly PdfTurnOperation[]
}

/** Replay-safe Turn projection published into the conversation timeline. */
export interface PdfTurnData {
  readonly files: readonly PdfTurnFile[]
}

export interface PdfTurnMatch extends PdfTurnData {
  readonly turn: number
}

interface PdfTurnState extends PdfTurnData {
  readonly turn: number
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationTurnDataMap {
    /** Structured PDF operations performed during this Turn. */
    pdfTurn: PdfTurnData
  }
}

/** Project structured PDF tool calls and results into a replay-safe Turn log. */
export const pdfTurnDefinition = {
  kind: 'pdfTurn',
  match(event: SessionEvent) {
    if (event.type === 'turn/start')
      return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call' || event.type === 'tool/result')
      return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start(_context, match): PdfTurnState {
    if (match.event.type !== 'turn/start')
      throw new Error('pdfTurn start match must be turn/start')
    return { turn: match.event.data.turn, files: [] }
  },
  update(context, match): PdfTurnState {
    if (match.event.type === 'tool/call')
      return addCall(context.state, match.event.data)
    if (match.event.type === 'tool/result')
      return applyResult(context.state, match.event.data)
    return context.state
  },
  buildLocationData(context, scope) {
    if (scope !== 'turn' || context.state === undefined) return null
    return {
      kind: 'turn',
      turn: context.state.turn,
      key: 'pdfTurn',
      value: { files: context.state.files },
    }
  },
} satisfies ConversationNodeDefinition<PdfTurnState>

/** Select a Turn-tail surface only when that Turn contains file-scoped PDF operations. */
export function selectPdfTurn(owner: TurnTailOwnerProps): PdfTurnMatch | null {
  const data = owner.turn.data.get('pdfTurn')
  if (data === undefined || data.files.length === 0) return null
  return { turn: owner.turn.turn, files: data.files }
}

function isPdfTool(name: string): name is PdfOperationName {
  return ['new', 'status', 'worktree', 'edit', 'export', 'screenshot'].includes(
    name.replace(/^pdf_/, ''),
  )
}

function addCall(
  state: PdfTurnState,
  data: SessionEvent<'tool/call'>['data'],
): PdfTurnState {
  if (!isPdfTool(data.name)) return state
  const record =
    typeof data.arguments === 'object' && data.arguments !== null
      ? (data.arguments as Record<string, unknown>)
      : {}
  const operation: PdfTurnOperation = {
    callId: data.callId,
    name: data.name,
    action: typeof record.action === 'string' ? record.action : null,
    file: typeof record.file === 'string' ? record.file : '',
    worktreeId:
      typeof record.worktreeId === 'string' ? record.worktreeId : null,
    phase: 'pending',
  }
  return appendOperation(state, operation)
}

function applyResult(
  state: PdfTurnState,
  data: SessionEvent<'tool/result'>['data'],
): PdfTurnState {
  const first = data.message.content[0]
  const callId = first.toolCallId
  const files = state.files.map((file) => ({
    ...file,
    operations: file.operations.map((operation) =>
      operation.callId === callId
        ? {
            ...operation,
            phase:
              data.error === undefined && first.isError !== true
                ? ('succeeded' as const)
                : ('failed' as const),
          }
        : operation,
    ),
  }))
  return { ...state, files }
}

function appendOperation(
  state: PdfTurnState,
  operation: PdfTurnOperation,
): PdfTurnState {
  const files = [...state.files]
  const existing = files.findIndex((file) => file.file === operation.file)
  if (existing === -1) {
    files.push({ file: operation.file, operations: [operation] })
  } else {
    const target = files[existing]
    if (target !== undefined)
      files[existing] = {
        file: target.file,
        operations: [...target.operations, operation],
      }
  }
  return { ...state, files }
}
