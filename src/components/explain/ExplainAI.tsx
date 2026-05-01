'use client'

import { useEffect, useRef, useState } from 'react'
import type { ExplainTopic } from '@/lib/explain/topics'

interface Props {
  topic: ExplainTopic
  params?: Record<string, string>
  /** Hash of inputs — when this changes we re-fetch the AI text. */
  inputsHash: string
}

export function ExplainAI({ topic, params, inputsHash }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setText('')
    setError(null)
    setDone(false)
    const controller = new AbortController()
    abortRef.current = controller

    void (async () => {
      try {
        const res = await fetch(`/api/explain/${topic}/ai`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ params: params ?? {} }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          setError('Kon interpretatie niet ophalen.')
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        for (;;) {
          const { value, done: streamDone } = await reader.read()
          if (streamDone) break
          if (value) setText((prev) => prev + decoder.decode(value, { stream: true }))
        }
        setDone(true)
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        setError('Kon interpretatie niet ophalen.')
      }
    })()

    return () => controller.abort()
  }, [topic, inputsHash, params])

  if (error) {
    return (
      <p className="text-footnote text-[var(--color-status-bad)]">
        {error}
      </p>
    )
  }

  if (!text) {
    return (
      <div className="space-y-2" aria-live="polite" aria-busy="true">
        <div className="h-3 w-11/12 animate-pulse rounded bg-bg-glass" />
        <div className="h-3 w-10/12 animate-pulse rounded bg-bg-glass" />
        <div className="h-3 w-9/12 animate-pulse rounded bg-bg-glass" />
      </div>
    )
  }

  return (
    <p
      className="whitespace-pre-wrap text-footnote leading-relaxed text-text-primary"
      aria-live="polite"
      aria-busy={!done}
    >
      {text}
    </p>
  )
}
