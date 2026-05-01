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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={[
          'block w-full text-left transition-opacity active:opacity-80 active:scale-[0.99]',
          className ?? '',
        ].join(' ')}
      >
        {children}
      </button>
      <ExplainSheet
        topic={open ? topic : null}
        params={params}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
