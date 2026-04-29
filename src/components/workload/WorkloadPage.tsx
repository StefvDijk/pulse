'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useWorkload } from '@/hooks/useWorkload'
import { ZoneBar } from './ZoneBar'
import { AcwrCorridor } from './AcwrCorridor'
import { SportCorrelations } from '@/components/belasting/SportCorrelations'
import { SportInsightCard } from '@/components/belasting/SportInsightCard'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { WorkloadData, WorkloadStatus } from '@/types/workload'

const STATUS_LABELS: Record<WorkloadStatus, string> = {
  low: 'Te licht',
  optimal: 'In balans',
  warning: 'Opbouw',
  danger: 'Overbelast',
}

const STATUS_COLORS: Record<WorkloadStatus, string> = {
  low: 'text-system-gray',
  optimal: 'text-system-green',
  warning: 'text-system-orange',
  danger: 'text-system-red',
}

interface ExplanationInput {
  status: WorkloadStatus
  ratio: number
  acuteSessions: number
  chronicSessions: number
  acuteLoad: number
  chronicLoad: number
}

function getExplanation(input: ExplanationInput): string {
  const { status, ratio, acuteSessions, chronicSessions, acuteLoad, chronicLoad } = input

  const pct = Math.round((ratio - 1) * 100)
  const absPct = Math.abs(pct)

  const loadTrend =
    absPct < 5
      ? 'Je totale belasting is gelijk aan je 28-daags gemiddelde.'
      : pct >= 0
        ? `Je totale belasting is ${absPct}% hoger dan je 28-daags gemiddelde.`
        : `Je totale belasting is ${absPct}% lager dan je 28-daags gemiddelde.`

  // Weekly session rate: chronic sessions over 4 weeks → per week average
  const chronicWeeklyRate = chronicSessions / 4
  const freqDiff = acuteSessions - chronicWeeklyRate
  const freqSimilar = Math.abs(freqDiff) <= 1

  // Per-session load comparison (avoid division by zero)
  const acutePerSession = acuteSessions > 0 ? (acuteLoad * 7) / acuteSessions : 0
  const chronicPerSession = chronicSessions > 0 ? (chronicLoad * 28) / chronicSessions : 0
  const sessionLoadLower = chronicPerSession > 0 && acutePerSession < chronicPerSession * 0.7

  // Build context line about sessions
  let sessionContext = ''
  if (freqSimilar && sessionLoadLower) {
    sessionContext = ' Normale frequentie, maar lichtere sessies dan je gewend bent.'
  } else if (freqSimilar) {
    sessionContext = ' Je trainingsfrequentie is normaal.'
  } else if (freqDiff > 1) {
    sessionContext = ` Je hebt meer sessies (${acuteSessions}) dan normaal (gem. ${Math.round(chronicWeeklyRate)}/week).`
  } else if (freqDiff < -1) {
    sessionContext = ` Je hebt minder sessies (${acuteSessions}) dan normaal (gem. ${Math.round(chronicWeeklyRate)}/week).`
  }

  switch (status) {
    case 'low':
      if (freqSimilar && sessionLoadLower) {
        return `${loadTrend}${sessionContext} Je traint even vaak, maar lichter — mogelijk een natuurlijke deload na een zware periode.`
      }
      return `${loadTrend}${sessionContext} Meerdere weken zo betekent fitness-verlies.`
    case 'optimal':
      return `${loadTrend}${sessionContext} Genoeg prikkel om sterker te worden, met ruimte voor herstel.`
    case 'warning':
      return `${loadTrend}${sessionContext} Je bouwt actief op. Blijf alert op vermoeidheid en zorg voor goede slaap.`
    case 'danger':
      return `${loadTrend}${sessionContext} Fors verhoogd blessurerisico. Overweeg een lichtere week of extra rustdag.`
  }
}

const MONTH_SHORT_NL = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
]

/** Format a YYYY-MM-DD date as "8 apr" (Dutch short). */
function formatShortNL(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${day} ${MONTH_SHORT_NL[month - 1]}`
}

function formatRange(startStr: string, endStr: string): string {
  return `${formatShortNL(startStr)} – ${formatShortNL(endStr)}`
}

export function WorkloadPage() {
  const { data, isLoading, error } = useWorkload()

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 pt-6">
      {/* Back nav — Apple HIG style */}
      <Link
        href="/"
        className="-ml-2 flex w-fit items-center gap-0.5 text-system-blue active:opacity-60 transition-opacity"
        aria-label="Terug naar home"
      >
        <ChevronLeft size={24} strokeWidth={2.5} />
        <span className="text-body">Terug</span>
      </Link>

      <h1 className="text-large-title font-bold tracking-tight text-label-primary">
        Belasting
      </h1>

      {isLoading && (
        <SkeletonCard className="flex flex-col gap-4">
          <SkeletonLine width="w-1/2" height="h-7" />
          <SkeletonLine width="w-3/4" />
          <SkeletonRect height="h-20" />
        </SkeletonCard>
      )}

      {error && <ErrorAlert message="Kon belasting niet laden." />}

      {data && (
        <>
          {/* Status + zone bar card */}
          <section className="rounded-3xl border border-separator bg-surface-primary p-6 shadow-apple-sm">
            <p className="text-caption2 font-semibold uppercase tracking-wider text-label-tertiary">
              Laatste 7 dagen · {formatRange(data.acuteStart, data.windowEnd)}
            </p>

            <div className="mt-2 flex items-baseline justify-between gap-4">
              <h2 className={`text-title1 font-bold ${STATUS_COLORS[data.status]}`}>
                {STATUS_LABELS[data.status]}
              </h2>
              <span className="text-title3 font-semibold tabular-nums text-label-secondary">
                {data.ratio.toFixed(2)}
              </span>
            </div>

            <p className="mt-3 text-subhead leading-snug text-label-secondary">
              {getExplanation({
                status: data.status,
                ratio: data.ratio,
                acuteSessions: data.acuteSessions,
                chronicSessions: data.chronicSessions,
                acuteLoad: data.acuteLoad,
                chronicLoad: data.chronicLoad,
              })}
            </p>

            <div className="mt-6">
              <ZoneBar ratio={data.ratio} />
            </div>
          </section>

          {/* Acute / Chronic loads with session context */}
          <section className="rounded-3xl border border-separator bg-surface-primary p-6 shadow-apple-sm">
            <h3 className="text-caption2 font-semibold uppercase tracking-wider text-label-tertiary">
              Trainingsbelasting
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {/* Acute column */}
              <div>
                <p className="text-title2 font-bold tabular-nums text-label-primary">
                  {Math.round(data.acuteLoad)}
                </p>
                <p className="mt-0.5 text-footnote font-medium text-label-primary">
                  Acute load
                </p>
                <p className="text-caption1 text-label-tertiary">
                  {data.acuteSessions} {data.acuteSessions === 1 ? 'sessie' : 'sessies'} in 7 dagen
                </p>
                {data.acuteSessions > 0 && (
                  <p className="text-caption1 tabular-nums text-label-tertiary">
                    gem. {Math.round((data.acuteLoad * 7) / data.acuteSessions)} per sessie
                  </p>
                )}
              </div>
              {/* Chronic column */}
              <div>
                <p className="text-title2 font-bold tabular-nums text-label-primary">
                  {Math.round(data.chronicLoad)}
                </p>
                <p className="mt-0.5 text-footnote font-medium text-label-primary">
                  Chronic load
                </p>
                <p className="text-caption1 text-label-tertiary">
                  {data.chronicSessions} {data.chronicSessions === 1 ? 'sessie' : 'sessies'} in 28 dagen
                </p>
                {data.chronicSessions > 0 && (
                  <p className="text-caption1 tabular-nums text-label-tertiary">
                    gem. {Math.round((data.chronicLoad * 28) / data.chronicSessions)} per sessie
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 8-week corridor — stay-in-the-band visualization */}
          {data.trend.length > 0 && (
            <section className="rounded-3xl border border-separator bg-surface-primary p-6 shadow-apple-sm">
              <div className="flex items-baseline justify-between">
                <h3 className="text-caption2 font-semibold uppercase tracking-wider text-label-tertiary">
                  Corridor · {data.trend.length} weken
                </h3>
                <span className="text-caption1 text-label-tertiary">
                  blijf in de groene band
                </span>
              </div>
              <div className="mt-3">
                <AcwrCorridor points={data.trend} />
              </div>
            </section>
          )}

          {/* Per-sport fatigue + 7-day contribution split */}
          <SportCorrelations />

          {/* AI-generated weekly pattern insight */}
          <SportInsightCard />

          {/* Explanation */}
          <section className="rounded-3xl border border-separator bg-surface-primary p-6 shadow-apple-sm">
            <h3 className="text-headline font-semibold text-label-primary">
              Wat betekent dit?
            </h3>
            <p className="mt-2 text-subhead leading-relaxed text-label-secondary">
              Je belasting (ACWR) vergelijkt hoe zwaar je de afgelopen{' '}
              <strong className="text-label-primary">7 dagen</strong> hebt
              getraind met je gemiddelde van de afgelopen{' '}
              <strong className="text-label-primary">28 dagen</strong>. Het
              cijfer laat zien of je lichaam mee kan komen, of dat je sneller
              opbouwt dan je herstelt.
            </p>

            <ul className="mt-5 space-y-3">
              <li className="flex gap-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: 'var(--color-system-gray3)' }}
                  aria-hidden="true"
                />
                <p className="text-subhead text-label-secondary">
                  <span className="font-semibold text-label-primary">
                    Te licht
                  </span>{' '}
                  · onder 0.6 — meerdere weken zo betekent fitness-verlies.
                </p>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-system-green"
                  aria-hidden="true"
                />
                <p className="text-subhead text-label-secondary">
                  <span className="font-semibold text-label-primary">
                    In balans
                  </span>{' '}
                  · 0.6 – 1.3 — sweet spot, prikkel met ruimte voor herstel.
                </p>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-system-orange"
                  aria-hidden="true"
                />
                <p className="text-subhead text-label-secondary">
                  <span className="font-semibold text-label-primary">
                    Opbouw
                  </span>{' '}
                  · 1.3 – 1.5 — actief progressief, blijf alert.
                </p>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-system-red"
                  aria-hidden="true"
                />
                <p className="text-subhead text-label-secondary">
                  <span className="font-semibold text-label-primary">
                    Overbelast
                  </span>{' '}
                  · boven 1.5 — fors verhoogd blessurerisico.
                </p>
              </li>
            </ul>

            <p className="mt-5 text-caption1 leading-relaxed text-label-tertiary">
              Je dagelijkse trainingsbelasting is een gewogen som van
              gym-tonnage, hardloop-afstand en -tempo, en padel-tijd. Rustdagen
              tellen als 0.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
