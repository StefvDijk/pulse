'use client'

import Markdown from 'react-markdown'

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
        className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
        style={
          isUser
            ? { backgroundColor: '#4f8cff', color: '#ffffff' }
            : { backgroundColor: '#1a1a2e', color: '#f0f0f5', border: '1px solid #2a2a3e' }
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            <Markdown
              components={{
                // Style headings
                h1: ({ children }) => (
                  <h1 className="mb-2 mt-3 text-base font-semibold" style={{ color: '#f0f0f5' }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-1.5 mt-3 text-sm font-semibold" style={{ color: '#f0f0f5' }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-1 mt-2 text-sm font-medium" style={{ color: '#c8c8e0' }}>
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
                  <strong className="font-semibold" style={{ color: '#f0f0f5' }}>
                    {children}
                  </strong>
                ),
                // Style code
                code: ({ children }) => (
                  <code
                    className="rounded px-1 py-0.5 text-xs"
                    style={{ backgroundColor: '#0a0a0f', color: '#4f8cff' }}
                  >
                    {children}
                  </code>
                ),
              }}
            >
              {content}
            </Markdown>
            {isStreaming && (
              <span
                className="ml-0.5 inline-block h-4 w-0.5 animate-pulse"
                style={{ backgroundColor: '#4f8cff' }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
