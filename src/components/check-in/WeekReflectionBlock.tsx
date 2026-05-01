'use client'

import { useId } from 'react'

export const MIN_REFLECTION_LENGTH = 10

interface WeekReflectionBlockProps {
  value: string
  onChange: (next: string) => void
}

export function WeekReflectionBlock({ value, onChange }: WeekReflectionBlockProps) {
  const id = useId()
  const length = value.trim().length
  const valid = length >= MIN_REFLECTION_LENGTH

  return (
    <div className="rounded-2xl border border-bg-border bg-bg-surface p-5">
      <label htmlFor={id} className="block text-[17px] font-semibold tracking-[-0.3px] text-text-primary">
        Hoe was je week?
      </label>
      <p className="mt-1 text-[13px] text-text-secondary">
        Een paar zinnen — wat ging top, wat liep tegen, hoe voelde je je.
      </p>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder="Schrijf hier…"
        className="mt-4 w-full resize-none rounded-xl border bg-white/[0.04] px-3.5 py-3 text-[15px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2"
        style={{
          borderColor: valid ? 'rgba(34,214,122,0.3)' : 'var(--color-bg-border)',
        }}
      />
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-text-tertiary">
          {valid ? 'Klaar om door te gaan' : `Min ${MIN_REFLECTION_LENGTH} tekens`}
        </span>
        <span className="tabular-nums text-text-tertiary">{length}/2000</span>
      </div>
    </div>
  )
}
