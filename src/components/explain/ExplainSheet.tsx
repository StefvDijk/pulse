'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useExplain } from '@/hooks/useExplain'
import type { ExplainTopic, ExplainInputRow } from '@/lib/explain/topics'
import { ExplainAI } from './ExplainAI'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface Props {
  topic: ExplainTopic | null
  params?: Record<string, string>
  onClose: () => void
}

export function ExplainSheet({ topic, params, onClose }: Props) {
  useBodyScrollLock(topic !== null)
  useEffect(() => {
    if (!topic) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [topic, onClose])

  const { payload, error, isLoading } = useExplain(topic, params)

  if (!topic) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={payload?.title ?? 'Uitleg'}
    >
      <div
        className="absolute inset-0 bg-[rgba(24,20,16,0.6)] backdrop-blur-[14px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex w-full max-w-md flex-col rounded-t-[28px] border-t-[0.5px] border-bg-border-strong bg-bg-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[85dvh] sm:rounded-[22px] sm:border-[0.5px] sm:pb-0">
        <div className="flex justify-center pt-2">
          <span className="h-1 w-9 rounded-full bg-bg-border-strong" aria-hidden="true" />
        </div>

        <div className="flex items-start justify-between gap-3 px-[18px] pt-3 pb-3">
          <div className="min-w-0">
            {payload?.eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">
                {payload.eyebrow}
              </p>
            ) : null}
            <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.4px] text-text-primary">
              {payload?.title ?? (isLoading ? 'Bezig met laden…' : 'Uitleg')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary hover:bg-white/[0.08]"
            aria-label="Sluiten"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[18px] pb-[18px]">
          {error ? (
            <p className="py-6 text-center text-footnote text-[var(--color-status-bad)]">
              Kon uitleg niet laden.
            </p>
          ) : null}

          {payload ? (
            <div className="flex flex-col gap-5">
              <Section title="Wat zie je hier?">
                <p className="text-footnote leading-relaxed text-text-primary">
                  {payload.definition}
                </p>
              </Section>

              <Section title="De cijfers">
                <ul className="flex flex-col gap-1.5">
                  {payload.inputs.map((row, idx) => (
                    <InputRow key={idx} row={row} />
                  ))}
                </ul>
              </Section>

              <Section title="Hoe wordt het berekend?">
                <p className="text-footnote leading-relaxed text-text-secondary">
                  {payload.formula}
                </p>
              </Section>

              <Section title="Wat betekent dit voor jou?">
                <ExplainAI topic={topic} params={params} inputsHash={payload.inputsHash} />
              </Section>

              {payload.sources.length > 0 ? (
                <Section title="Bronnen">
                  <p className="text-caption1 text-text-tertiary">
                    {payload.sources.join(' · ')}
                  </p>
                </Section>
              ) : null}
            </div>
          ) : null}
        </div>

        {payload?.primaryAction ? (
          <div className="border-t-[0.5px] border-bg-border px-[18px] py-3">
            <Link
              href={payload.primaryAction.href}
              className="flex h-12 items-center justify-center rounded-[14px] bg-white text-[15px] font-semibold text-black active:opacity-80"
              onClick={onClose}
            >
              {payload.primaryAction.label}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">
        {title}
      </h3>
      {children}
    </section>
  )
}

function InputRow({ row }: { row: ExplainInputRow }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[12px] bg-black/20 px-3 py-2">
      <span className="min-w-0 truncate text-footnote text-text-secondary">{row.label}</span>
      <span className="shrink-0 text-right text-footnote font-semibold tabular-nums text-text-primary">
        {row.value}
        {row.unit ? <span className="text-text-tertiary"> {row.unit}</span> : null}
        {row.baseline ? (
          <span className="ml-1 text-caption1 font-normal text-text-tertiary">
            (baseline {row.baseline})
          </span>
        ) : null}
      </span>
    </li>
  )
}
