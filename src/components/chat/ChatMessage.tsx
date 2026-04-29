'use client'

import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CoachOrb } from '@/components/shared/CoachOrb'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

// Module-level so react-markdown sees a stable reference across renders.
// Inline objects break memoization and re-create render functions on every chunk.
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-headline font-semibold text-label-primary">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-subhead font-semibold text-label-primary">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-subhead font-medium text-label-secondary">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-subhead">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded px-1 py-0.5 text-caption1 bg-system-gray5 text-system-blue font-mono">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-caption1">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-separator">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-medium text-label-secondary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 border-b border-separator">{children}</td>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
}

const REMARK_PLUGINS = [remarkGfm]

function ChatMessageImpl({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-2.5 text-subhead ${
          isUser
            ? 'bg-system-blue text-white rounded-2xl rounded-br-md'
            : 'bg-system-gray6 text-label-primary rounded-2xl rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="max-w-none">
            <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
              {content}
            </Markdown>
            {isStreaming && (
              <CoachOrb size={12} state="streaming" className="ml-1.5 align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const ChatMessage = memo(ChatMessageImpl)
