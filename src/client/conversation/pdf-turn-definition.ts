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
  const turn = (
    owner as unknown as {
      turn?: {
        turn?: number
        data?: Map<string, unknown> | Record<string, unknown>
      }
    }
  )?.turn
  if (!turn?.data) return null
  const data =
    turn.data instanceof Map
      ? (turn.data.get('pdfTurn') as PdfTurnData | undefined)
      : typeof (turn.data as Record<string, unknown>).get === 'function'
        ? ((turn.data as { get: (k: string) => unknown }).get('pdfTurn') as
            | PdfTurnData
            | undefined)
        : ((turn.data as Record<string, unknown>).pdfTurn as
            | PdfTurnData
            | undefined)
  if (
    data === undefined ||
    !Array.isArray(data.files) ||
    data.files.length === 0
  )
    return null
  return { turn: turn.turn ?? 1, files: data.files }
}

function isPdfTool(name: string): boolean {
  return (
    name.startsWith('pdf_') &&
    ['new', 'status', 'worktree', 'edit', 'export', 'screenshot'].includes(
      name.replace(/^pdf_/, ''),
    )
  )
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

function structuredResult(
  data: SessionEvent<'tool/result'>['data'],
): Record<string, unknown> | null {
  const content = (
    data.message?.content?.[0] as {
      content?: Array<{ type?: string; text?: string }>
    }
  )?.content
  const text =
    content
      ?.flatMap((block) =>
        block.type === 'text' && typeof block.text === 'string'
          ? [block.text]
          : [],
      )
      .join('\n') ?? ''
  const firstBrace = text.indexOf('{')
  return firstBrace === -1 ? null : parseRecord(text.slice(firstBrace))
}

function addCall(
  state: PdfTurnState,
  data: SessionEvent<'tool/call'>['data'],
): PdfTurnState {
  if (!isPdfTool(data.name)) return state
  const record = parseRecord(data.arguments) ?? {}
  const file = typeof record.file === 'string' ? record.file : ''
  if (!file) return state
  const operation: PdfTurnOperation = {
    callId: data.callId,
    name: data.name.replace(/^pdf_/, '') as PdfOperationName,
    action: typeof record.action === 'string' ? record.action : null,
    file,
    worktreeId:
      typeof record.worktreeId === 'string' ? record.worktreeId : null,
    phase: 'pending',
  }
  return { ...state, files: appendOperation(state.files, operation) }
}

function applyResult(
  state: PdfTurnState,
  data: SessionEvent<'tool/result'>['data'],
): PdfTurnState {
  const first = data.message?.content?.[0]
  if (first === undefined) return state
  const callId = first.toolCallId
  const structured = structuredResult(data)

  let matched: PdfTurnOperation | undefined
  for (const file of state.files) {
    const op = file.operations.find((entry) => entry.callId === callId)
    if (op !== undefined) matched = op
  }
  if (matched === undefined && structured === null) return state

  const result =
    structured === null ||
    typeof structured.result !== 'object' ||
    structured.result === null
      ? null
      : (structured.result as Record<string, unknown>)
  const name =
    matched?.name ??
    (typeof structured?.operation === 'string'
      ? (structured.operation.replace(/^pdf_/, '') as PdfOperationName)
      : undefined)
  const file =
    typeof structured?.file === 'string' ? structured.file : matched?.file
  if (name === undefined || file === undefined) return state

  const operation: PdfTurnOperation = {
    callId,
    name,
    action:
      typeof result?.action === 'string'
        ? result.action
        : (matched?.action ?? null),
    file,
    worktreeId:
      typeof result?.worktreeId === 'string'
        ? result.worktreeId
        : (matched?.worktreeId ?? null),
    phase:
      data.error === undefined && first.isError !== true
        ? 'succeeded'
        : 'failed',
  }

  const withoutCall = state.files.flatMap((entry) => {
    const operations = entry.operations.filter(
      (candidate) => candidate.callId !== callId,
    )
    return operations.length === 0 ? [] : [{ ...entry, operations }]
  })

  return { ...state, files: appendOperation(withoutCall, operation) }
}

function matchesFile(a: string, b: string): boolean {
  if (a === b) return true
  if (a.endsWith(`/${b}`) || b.endsWith(`/${a}`)) return true
  return false
}

function appendOperation(
  files: readonly PdfTurnFile[],
  operation: PdfTurnOperation,
): PdfTurnFile[] {
  const next = [...files]
  const existing = next.findIndex((file) =>
    matchesFile(file.file, operation.file),
  )
  if (existing === -1) {
    next.push({ file: operation.file, operations: [operation] })
  } else {
    const target = next[existing]
    if (target !== undefined)
      next[existing] = {
        file: target.file,
        operations: [...target.operations, operation],
      }
  }
  return next
}
