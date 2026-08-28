import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { worktreeId } from '../../service/identifiers.ts'
import { operationOutput, operationTitle } from '../presentation.ts'
import { existingToolFile, newToolFile } from '../workspace.ts'

/** Create the `pdf_new` tool definition. */
export function newTool(ctx: Context, timeoutMs: number) {
  return defineTool({
    name: 'pdf_new',
    description:
      'Create a new empty single-page PDF file in the current workspace. This never overwrites an existing file.',
    timeoutMs,
    parameters: {
      file: {
        type: 'string',
        required: true,
        description:
          'Workspace-relative or absolute output path ending in .pdf.',
      },
    },
    output: operationOutput,
    async execute(args, exec) {
      const target = await newToolFile(exec, args.file)
      const state = await ctx.pdf.newFile(
        { workspace: target.workspace, file: target.path },
        exec.signal,
      )
      return {
        ok: true,
        operation: 'new' as const,
        file: target.path,
        result: state,
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: operationTitle('new', args.file),
      kind: 'execute',
    }),
  })
}

/** Create the `pdf_status` tool definition. */
export function statusTool(ctx: Context, timeoutMs: number) {
  return defineTool({
    name: 'pdf_status',
    description:
      'List trunk and worktree state for a PDF file, including page counts and draft lifecycles. Call this before choosing a worktreeId.',
    timeoutMs,
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Workspace-relative or absolute .pdf path.',
      },
      worktreeId: {
        type: 'string',
        description: 'Optional worktree whose state should be returned.',
      },
    },
    output: operationOutput,
    async execute(args, exec) {
      const target = await existingToolFile(exec, args.file)
      const state = await ctx.pdf.status(
        {
          workspace: target.workspace,
          file: target.path,
          ...(args.worktreeId === undefined
            ? {}
            : { worktreeId: worktreeId(args.worktreeId) }),
        },
        exec.signal,
      )
      return {
        ok: true,
        operation: 'status' as const,
        file: target.path,
        result: state,
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: operationTitle('status', args.file),
      kind: 'read',
    }),
  })
}

/** Create the `pdf_worktree` tool definition. */
export function worktreeTool(ctx: Context, timeoutMs: number) {
  return defineTool({
    name: 'pdf_worktree',
    description:
      'Create, ready, reopen, merge, or discard an isolated draft worktree for a PDF file. Only merge and discard are user-approved and destructive.',
    timeoutMs,
    parameters: {
      file: {
        type: 'string',
        required: true,
        description: 'Workspace-relative or absolute .pdf path.',
      },
      action: {
        type: 'string',
        required: true,
        enum: ['create', 'ready', 'reopen', 'merge', 'discard'],
        description:
          'Lifecycle action: create a draft, ready it for review, reopen for more edits, or merge/discard after user approval.',
      },
      worktreeId: {
        type: 'string',
        description: 'Required for ready/reopen/merge/discard.',
      },
      name: {
        type: 'string',
        description: 'Optional draft name used when action is create.',
      },
    },
    output: operationOutput,
    async execute(args, exec) {
      const target = await existingToolFile(exec, args.file)
      const base = { workspace: target.workspace, file: target.path }
      if (args.action !== 'create') {
        if (args.worktreeId === undefined)
          throw new Error(
            'worktreeId is required for ready/reopen/merge/discard',
          )
        const result = await ctx.pdf.worktree(
          {
            ...base,
            action: args.action,
            worktreeId: worktreeId(args.worktreeId),
          },
          exec.signal,
        )
        return {
          ok: true,
          operation: 'worktree' as const,
          file: target.path,
          result,
        }
      }
      const result = await ctx.pdf.worktree(
        {
          ...base,
          action: 'create',
          ...(args.name === undefined ? {} : { name: args.name }),
        },
        exec.signal,
      )
      return {
        ok: true,
        operation: 'worktree' as const,
        file: target.path,
        result,
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: operationTitle(`worktree:${args.action}`, args.file),
      kind: 'execute',
    }),
  })
}
