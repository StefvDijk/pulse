'use client'

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-bg-active text-text-primary'
            : 'bg-bg-card text-text-primary border border-border-light'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Style headings
                h1: ({ children }) => (
                  <h1 className="mb-2 mt-3 text-base font-semibold">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-1.5 mt-3 text-sm font-semibold">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-1 mt-2 text-sm font-medium text-text-secondary">
                    {children}
                  </h3>
                ),
                // Style paragraphs
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                ),
                // Style lists
                ul: ({ children }) => (
                  <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
                ),
                li: ({ children }) => <li className="text-sm">{children}</li>,
                // Style strong
                strong: ({ children }) => (
                  <strong className="font-semibold">
                    {children}
                  </strong>
                ),
                // Style code
                code: ({ children }) => (
                  <code
                    className="rounded px-1 py-0.5 text-xs bg-bg-subtle text-accent-link"
                  >
                    {children}
                  </code>
                ),
                // Style tables (GFM)
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="border-b border-border-medium">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-2 py-1 text-left font-medium text-text-secondary">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-2 py-1 border-b border-border-light">
                    {children}
                  </td>
                ),
                tr: ({ children }) => <tr>{children}</tr>,
              }}
            >
              {content}
            </Markdown>
            {isStreaming && (
              <span
                className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
