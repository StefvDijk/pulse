'use client'

import { useState, type ReactNode } from 'react'
import type { ExplainTopic } from '@/lib/explain/topics'
import { ExplainSheet } from './ExplainSheet'

interface Props {
  topic: ExplainTopic
  params?: Record<string, string>
  ariaLabel: string
  children: ReactNode
  className?: string
}

export function ExplainTrigger({ topic, params, ariaLabel, children, className }: Props) {
  const [open, setOpen] = useState(false)

  // role="button" on a div (not a real <button>) because the card content can
  // itself contain buttons (e.g. "Wat bepaalt dit?"); a <button> nesting a
  // <button> is invalid HTML and caused a hydration error on Home + Gezondheid.
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={[
          'block w-full cursor-pointer text-left transition-opacity active:opacity-80 active:scale-[0.99]',
          className ?? '',
        ].join(' ')}
      >
        {children}
      </div>
      <ExplainSheet
        topic={open ? topic : null}
        params={params}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
