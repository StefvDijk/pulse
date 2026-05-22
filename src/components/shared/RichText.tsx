'use client'

import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-[15px] font-semibold text-text-primary first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[14px] font-semibold text-text-primary first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-[13px] font-medium text-text-secondary first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded px-1 py-0.5 text-[12px] bg-white/[0.08] text-text-primary font-mono">{children}</code>
  ),
  hr: () => <hr className="my-2 border-bg-border" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-bg-border pl-3 my-2 text-text-secondary">{children}</blockquote>
  ),
}

const REMARK_PLUGINS = [remarkGfm]

interface RichTextProps {
  content: string
  className?: string
}

function RichTextImpl({ content, className }: RichTextProps) {
  return (
    <div className={className}>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {content}
      </Markdown>
    </div>
  )
}

export const RichText = memo(RichTextImpl)
