'use client'

import { useState } from 'react'
import { Card, ReadinessOrb, MicroStat } from '@/components/ui/v2'
import { ExplainTrigger } from '@/components/explain/ExplainTrigger'
import { ReadinessDrilldownSheet } from '@/components/home/ReadinessDrilldownSheet'
import type { ReadinessData } from '@/types/readiness'
import type { ReadinessSummary } from '@/app/api/readiness/summary/route'

export interface ReadinessCardProps {
  readiness: ReadinessData | null | undefined
  summary: ReadinessSummary | null | undefined
  score: number
  label: string
  tone: 'good' | 'warn' | 'bad'
}

export function ReadinessCard({
  readiness,
  summary,
  score,
  label,
  tone,
}: ReadinessCardProps) {
  const [drilldownOpen, setDrilldownOpen] = useState(false)

  const sleepHours = readiness?.sleepMinutes ? Math.floor(readiness.sleepMinutes / 60) : null
  const sleepMins = readiness?.sleepMinutes ? readiness.sleepMinutes % 60 : null

  const toneClass =
    tone === 'good'
      ? 'text-[var(--color-status-good)]'
      : tone === 'warn'
        ? 'text-[var(--color-status-warn)]'
        : 'text-[var(--color-status-bad)]'

  return (
    <>
      <ExplainTrigger topic="readiness" ariaLabel="Open uitleg over readiness">
        <Card
          className="p-[18px]"
          style={{ background: 'linear-gradient(135deg, #1E2230 0%, #2A3340 100%)' }}
        >
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
            <p className="mt-3 text-[13px] leading-snug text-text-secondary">
              {summary.sentence}
            </p>
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

      <ReadinessDrilldownSheet
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
      />
    </>
  )
}
