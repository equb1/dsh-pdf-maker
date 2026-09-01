import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { PreviewCard } from './components/preview-card.tsx'
import {
  pdfTurnDefinition,
  selectPdfTurn,
} from './conversation/pdf-turn-definition.ts'
import { en, PDF_LOCALE_NAMESPACE, zh } from './locales/index.ts'
import { worktreeStyles } from './styles/worktree.ts'

export const inject = ['slots', 'locale', 'conversationEvents']

/** Register the DSH browser projections for PDF files and worktrees. */
export function apply(ctx: ClientContext): void {
  injectStyles('dsh-pdf-maker/styles', worktreeStyles)
  try {
    ctx.conversationEvents.register(pdfTurnDefinition)
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('already registered')
    )
      throw error
  }
  ctx.effect(
    () => ctx.locale.register(PDF_LOCALE_NAMESPACE, { zh, en }),
    'pdf: dictionaries',
  )
  ctx.effect(
    () =>
      ctx.slots.inject('conversation.chat.turnTail', () =>
        ctx.slots.register(
          {
            name: 'conversation.chat.turnTail',
            // Higher priority (lower number) than dsh-univer-office's -10 so a
            // PDF turn claims the turn-tail slot before the univer plugin does.
            priority: -20,
            locale: PDF_LOCALE_NAMESPACE,
            select: selectPdfTurn,
          },
          PreviewCard,
        ),
      ),
    'pdf: turn preview',
  )
}

function injectStyles(id: string, css: string): void {
  if (
    document.querySelector(`style[data-plugin-css=${JSON.stringify(id)}]`) !==
    null
  )
    return
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-pdf-maker'
  style.dataset.pluginCss = id
  style.textContent = css
  document.head.appendChild(style)
}
