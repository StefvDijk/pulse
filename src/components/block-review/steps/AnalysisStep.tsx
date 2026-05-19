'use client'

import { useEffect, useRef, useState } from 'react'
import { StepShell } from '../StepShell'
import { CoachOrb } from '@/components/shared/CoachOrb'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  onAnalysed: (analysis: string, proposal: unknown) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

function extractProposal(text: string): { clean: string; proposal: unknown | null } {
  const match = /<block_proposal>([\s\S]*?)<\/block_proposal>/i.exec(text)
  if (!match) return { clean: text, proposal: null }
  let proposal: unknown = null
  try {
    proposal = JSON.parse(match[1].trim())
  } catch {
    proposal = null
  }
  return { clean: text.replace(match[0], '').trim(), proposal }
}

export function AnalysisStep({ data, form, onAnalysed, stepIndex, stepTotal, onBack, onNext }: Props) {
  const [output, setOutput] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const controller = new AbortController()
    let cancelled = false

    async function run() {
      try {
        const res = await fetch('/api/block-review/analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema_id: data.schema.id, reflection: form.reflection }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error('Analyse mislukt')
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let acc = ''
        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          acc += decoder.decode(value)
          if (!cancelled) setOutput(acc)
        }
        if (!cancelled) {
          const { clean, proposal } = extractProposal(acc)
          setOutput(clean)
          setDone(true)
          onAnalysed(clean, proposal)
        }
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return
        setError((err as Error).message)
      }
    }
    run()
    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <StepShell
      title="Coach analyse"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={done ? onNext : undefined}
      nextLabel="Naar volgend blok"
    >
      <div className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <CoachOrb size={22} />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
            Coach (Opus 4.7)
          </span>
        </div>
        {error ? (
          <div className="text-status-danger text-[13px]">{error}</div>
        ) : (
          <div className="text-[14px] leading-[1.55] text-text-primary whitespace-pre-wrap">
            {output || 'Aan het analyseren…'}
          </div>
        )}
      </div>
    </StepShell>
  )
}
