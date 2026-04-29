'use client'

import { Sparkles } from 'lucide-react'
import { useSportInsight } from '@/hooks/useSportInsight'

function formatSourceDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Amsterdam',
  })
}

export function SportInsightCard() {
  const { insight, sourceDate, isLoading } = useSportInsight()

  if (isLoading || !insight) return null

  const dateLabel = formatSourceDate(sourceDate)

  return (
    <section className="rounded-3xl border border-separator bg-surface-primary p-6 shadow-apple-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-system-blue/10">
          <Sparkles size={16} className="text-system-blue" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-caption2 font-semibold uppercase tracking-wider text-label-tertiary">
            Coach-observatie
          </h3>
          <p className="mt-1 text-subhead leading-snug text-label-primary">{insight}</p>
          {dateLabel && (
            <p className="mt-2 text-caption1 text-label-tertiary">Laatst bijgewerkt {dateLabel}</p>
          )}
        </div>
      </div>
    </section>
  )
}
