'use client'

import { useState } from 'react'
import { Card, ReadinessOrb, MicroStat } from '@/components/ui/v2'
import { ExplainTrigger } from '@/components/explain/ExplainTrigger'
import { ReadinessDrilldownSheet } from '@/components/home/ReadinessDrilldownSheet'
import type { ReadinessData } from '@/types/readiness'
import type { ReadinessSummary } from '@/app/api/readiness/summary/route'
import type { ReadinessView } from './readiness-view'

export interface ReadinessCardProps {
  view: ReadinessView
  readiness: ReadinessData | null | undefined
  summary: ReadinessSummary | null | undefined
  label: string
  tone: 'good' | 'warn' | 'bad'
  onRetry: () => void
}

const CARD_GRADIENT = 'linear-gradient(135deg, #1E2230 0%, #2A3340 100%)'

export function ReadinessCard({ view, readiness, summary, label, tone, onRetry }: ReadinessCardProps) {
  const [drilldownOpen, setDrilldownOpen] = useState(false)

  if (view.status === 'loading') {
    return (
      <Card className="p-[18px]" style={{ background: CARD_GRADIENT }}>
        <div className="flex items-center gap-[18px]">
          <div className="h-[108px] w-[108px] shrink-0 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-9 w-16 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-3 w-28 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
      </Card>
    )
  }

  if (view.status === 'unavailable') {
    return (
      <Card className="p-[18px]" style={{ background: CARD_GRADIENT }}>
        <div className="flex items-center gap-[18px]">
          <div
            className="flex h-[108px] w-[108px] shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]"
            aria-hidden="true"
          >
            <span className="text-[28px] font-bold text-text-tertiary">—</span>
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">
              Readiness
            </div>
            <div className="mt-1 text-[15px] font-semibold text-text-secondary">
              Nog niet beschikbaar
            </div>
            <p className="mt-1 text-[12px] leading-snug text-text-tertiary">
              Je herstelgegevens konden niet worden geladen. Zodra je biometrie
              (HRV, slaap, rusthart) binnen is, verschijnt hier je score.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3.5 w-full rounded-lg border border-bg-border bg-white/[0.04] py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] focus-ring"
        >
          Opnieuw proberen
        </button>
      </Card>
    )
  }

  // status === 'ready'
  const score = view.score
  const toneClass =
    tone === 'good'
      ? 'text-[var(--color-status-good)]'
      : tone === 'warn'
        ? 'text-[var(--color-status-warn)]'
        : 'text-[var(--color-status-bad)]'

  const sleepHours = readiness?.sleepMinutes ? Math.floor(readiness.sleepMinutes / 60) : null
  const sleepMins = readiness?.sleepMinutes ? readiness.sleepMinutes % 60 : null

  return (
    <>
      <ExplainTrigger topic="readiness" ariaLabel="Open uitleg over readiness">
        <Card className="p-[18px]" style={{ background: CARD_GRADIENT }}>
          <div className="flex items-center gap-[18px]">
            <ReadinessOrb value={score / 100} size={108} />
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">
                Readiness
              </div>
              <div className="text-[44px] font-bold leading-none tracking-[-1.2px] text-text-primary tabular-nums">
                {score}
              </div>
              <div className={`mt-0.5 text-[12px] font-medium ${toneClass}`}>{label}</div>
            </div>
          </div>

          {summary?.sentence && (
            <p className="mt-3 text-[13px] leading-snug text-text-secondary">{summary.sentence}</p>
          )}

          {summary?.coldStart?.active && (
            <p className="mt-2 text-[11px] text-text-tertiary" aria-live="polite">
              Pulse leert nog je baseline. Nog{' '}
              <span className="font-semibold text-text-secondary">
                {summary.coldStart.nightsRemaining}{' '}
                {summary.coldStart.nightsRemaining === 1 ? 'nacht' : 'nachten'}
              </span>{' '}
              voor betrouwbare readiness.
            </p>
          )}

          <div className="mt-[18px] grid grid-cols-4 gap-2.5 border-t-[0.5px] border-bg-border pt-3.5">
            <MicroStat
              label="HRV"
              value={readiness?.hrv ?? '—'}
              delta={readiness?.hrv ? 'ms' : undefined}
              good
            />
            <MicroStat
              label="RHR"
              value={readiness?.restingHR ?? '—'}
              delta={readiness?.restingHR ? 'bpm' : undefined}
              good
            />
            <MicroStat
              label="Slaap"
              value={sleepHours !== null ? `${sleepHours}u ${sleepMins}m` : '—'}
            />
            <MicroStat label="Sessies" value={readiness?.recentSessions ?? '—'} delta="7d" />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDrilldownOpen(true)
            }}
            className="mt-3 w-full rounded-lg border border-bg-border bg-white/[0.04] py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] focus-ring"
          >
            Wat bepaalt dit? →
          </button>
        </Card>
      </ExplainTrigger>

      <ReadinessDrilldownSheet open={drilldownOpen} onClose={() => setDrilldownOpen(false)} />
    </>
  )
}
