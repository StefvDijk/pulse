'use client'

import { memo } from 'react'
import Link from 'next/link'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { CardRenderer } from '@/components/chat/cards/CardRenderer'
import { formatTime } from '@/lib/time/amsterdam'
import type { AnyCard } from '@/lib/ai/chat/cards'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  timestamp?: string | null
  cards?: AnyCard[]
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-headline font-semibold text-text-primary">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-subhead font-semibold text-text-primary">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-subhead font-medium text-text-secondary">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-subhead">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => {
    const target = href ?? '#'
    // Internal deep-links (e.g. a coach pointing to /block-review) navigate
    // client-side; external links open in a new tab. Accented so coach CTAs
    // read as tappable actions, not raw URLs.
    const className = 'font-medium underline decoration-text-tertiary/50 underline-offset-2 text-brand-claude'
    if (target.startsWith('/')) {
      return (
        <Link href={target} className={className}>
          {children}
        </Link>
      )
    }
    return (
      <a href={target} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  },
  code: ({ children }) => (
    <code className="rounded px-1 py-0.5 text-caption1 bg-white/[0.08] text-[#0A84FF] font-mono">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-caption1">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-bg-border">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-medium text-text-secondary">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 border-b border-bg-border">{children}</td>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
}

const REMARK_PLUGINS = [remarkGfm]

// Stable-ish React key: type + a discriminating field per card, plus index as
// a tiebreaker (the coach may emit multiples of one type in a single answer).
function cardKey(card: AnyCard, index: number): string {
  switch (card.type) {
    case 'workout':
      return `workout-${card.title}-${index}`
    case 'weekplan_card':
      return `weekplan-${card.week}-${index}`
    case 'stat_card':
      return `stat-${card.label}-${index}`
    case 'writeback_card':
      return `writeback-${card.kind}-${index}`
  }
}

function ChatMessageImpl({ role, content, isStreaming, timestamp, cards }: ChatMessageProps) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="flex justify-end">
          <div
            className="max-w-[80%] bg-bg-elevated text-text-primary text-subhead px-4 py-2.5"
            style={{ borderRadius: 'var(--radius-card-md) var(--radius-card-md) 6px var(--radius-card-md)' }}
          >
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        </div>
        {timestamp && !isStreaming && (
          <time
            dateTime={timestamp}
            className="mt-0.5 pr-1 text-[10px] text-text-tertiary"
          >
            {formatTime(timestamp)}
          </time>
        )}
      </div>
    )
  }

  // Assistant bubble
  return (
    <div className="flex flex-col">
      <div className="flex items-end gap-2">
        <CoachOrb
          size={20}
          state={isStreaming ? 'streaming' : 'idle'}
          className="mb-0.5 shrink-0 self-end"
        />
        <div
          className="max-w-[85%] bg-gradient-coach text-text-primary text-subhead px-4 py-2.5 border-[0.5px] border-white/[0.08]"
          style={{ borderRadius: 'var(--radius-card-md) var(--radius-card-md) var(--radius-card-md) 6px' }}
        >
          <div className="max-w-none">
            <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
              {content}
            </Markdown>
            {isStreaming && content.length === 0 && (
              <span className="inline-flex gap-1 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:300ms]" />
              </span>
            )}
          </div>
          {/* Cards render below prose, inside the bubble */}
          {cards && cards.length > 0 && (
            <div className="mt-1">
              {cards.map((card, i) => (
                <CardRenderer key={cardKey(card, i)} card={card} />
              ))}
            </div>
          )}
        </div>
      </div>
      {timestamp && !isStreaming && (
        <time
          dateTime={timestamp}
          className="mt-0.5 ml-7 text-[10px] text-text-tertiary"
        >
          {formatTime(timestamp)}
        </time>
      )}
    </div>
  )
}

export const ChatMessage = memo(ChatMessageImpl)
