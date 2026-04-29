'use client'

import Link from 'next/link'
import { ChevronLeft, Check } from 'lucide-react'
import { useWorkload } from '@/hooks/useWorkload'
import { AcwrCorridor } from './AcwrCorridor'
import { SportCorrelations } from '@/components/belasting/SportCorrelations'
import { SportInsightCard } from '@/components/belasting/SportInsightCard'
import { Card, ZoneBar } from '@/components/ui/v2'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { WorkloadData, WorkloadStatus } from '@/types/workload'

const STATUS_LABELS: Record<WorkloadStatus, string> = {
  low: 'Te licht',
  optimal: 'In balans',
  warning: 'Opbouw',
  danger: 'Overbelast',
}

const STATUS_COLOR: Record<WorkloadStatus, string> = {
  low: 'var(--color-text-tertiary)',
  optimal: 'var(--color-status-good)',
  warning: 'var(--color-status-warn)',
  danger: 'var(--color-status-bad)',
}

const STATUS_BG: Record<WorkloadStatus, string> = {
  low: 'rgba(142,142,147,0.15)',
  optimal: 'rgba(34,214,122,0.15)',
  warning: 'rgba(255,176,32,0.15)',
  danger: 'rgba(255,77,109,0.15)',
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
  const chronicWeeklyRate = chronicSessions / 4
  const freqDiff = acuteSessions - chronicWeeklyRate
  const freqSimilar = Math.abs(freqDiff) <= 1
  const acutePerSession = acuteSessions > 0 ? (acuteLoad * 7) / acuteSessions : 0
  const chronicPerSession = chronicSessions > 0 ? (chronicLoad * 28) / chronicSessions : 0
  const sessionLoadLower = chronicPerSession > 0 && acutePerSession < chronicPerSession * 0.7
  let sessionContext = ''
  if (freqSimilar && sessionLoadLower) sessionContext = ' Normale frequentie, lichtere sessies dan je gewend bent.'
  else if (freqSimilar) sessionContext = ' Je trainingsfrequentie is normaal.'
  else if (freqDiff > 1) sessionContext = ` Meer sessies (${acuteSessions}) dan normaal (gem. ${Math.round(chronicWeeklyRate)}/week).`
  else if (freqDiff < -1) sessionContext = ` Minder sessies (${acuteSessions}) dan normaal (gem. ${Math.round(chronicWeeklyRate)}/week).`
  switch (status) {
    case 'low':
      return freqSimilar && sessionLoadLower
        ? `${loadTrend}${sessionContext} Je traint even vaak, maar lichter — mogelijk een natuurlijke deload.`
        : `${loadTrend}${sessionContext} Meerdere weken zo betekent fitness-verlies.`
    case 'optimal':
      return `${loadTrend}${sessionContext} Genoeg prikkel om sterker te worden, met ruimte voor herstel.`
    case 'warning':
      return `${loadTrend}${sessionContext} Je bouwt actief op. Blijf alert op vermoeidheid en zorg voor goede slaap.`
    case 'danger':
      return `${loadTrend}${sessionContext} Fors verhoogd blessurerisico. Overweeg een lichtere week.`
  }
}

interface StatTileProps {
  label: string
  value: string | number
  unit?: string
}

function StatTile({ label, value, unit }: StatTileProps) {
  return (
    <Card className="p-[14px]">
      <div className="text-[11px] font-medium text-text-tertiary">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-[24px] font-bold tracking-[-0.6px] text-text-primary tabular-nums">{value}</div>
        {unit && <div className="text-[11px] text-text-tertiary">{unit}</div>}
      </div>
    </Card>
  )
}

export function WorkloadPage() {
  const { data, isLoading, error } = useWorkload()

  return (
    <div className="flex flex-col gap-3.5 px-4 pb-24 pt-[60px]">
      <Link
        href="/"
        className="-ml-1 flex w-fit items-center gap-0.5 text-[#0A84FF] active:opacity-60 transition-opacity"
        aria-label="Terug naar home"
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
        <span className="text-[17px] tracking-[-0.2px]">Terug</span>
      </Link>

      <div className="pt-1">
        <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Belasting</h1>
        <div className="mt-1 text-[13px] text-text-tertiary">Acute vs. chronische belasting · laatste 28 dagen</div>
      </div>

      {isLoading && (
        <SkeletonCard className="flex flex-col gap-4">
          <SkeletonLine width="w-1/2" height="h-7" />
          <SkeletonRect height="h-20" />
        </SkeletonCard>
      )}

      {error && <ErrorAlert message="Kon belasting niet laden." />}

      {data && (
        <>
          {/* Big ratio card */}
          <Card className="p-5 border-bg-border-strong">
            <div className="flex items-start justify-between">
              <div>
                <div
                  className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.4px]"
                  style={{ color: STATUS_COLOR[data.status] }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: STATUS_COLOR[data.status],
                      boxShadow: `0 0 8px ${STATUS_COLOR[data.status]}`,
                    }}
                  />
                  {STATUS_LABELS[data.status]}
                </div>
                <div className="mt-2 text-[64px] font-bold leading-none tracking-[-2px] text-text-primary tabular-nums">
                  {data.ratio.toFixed(2)}
                </div>
                <div className="mt-1 text-[12px] text-text-tertiary">acute : chronisch ratio</div>
              </div>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background: STATUS_BG[data.status],
                  border: `1px solid ${STATUS_COLOR[data.status]}66`,
                  boxShadow: `0 0 20px ${STATUS_COLOR[data.status]}4d`,
                }}
              >
                <Check size={22} strokeWidth={2.5} style={{ color: STATUS_COLOR[data.status] }} />
              </div>
            </div>

            <div className="mt-5">
              <ZoneBar value={Math.max(0, Math.min(1, data.ratio / 2.0))} />
              <div className="mt-2 flex justify-between text-[10px] text-text-tertiary tabular-nums">
                <span>0.6</span>
                <span>0.8</span>
                <span>1.3</span>
                <span>1.5</span>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-snug text-text-secondary">
              {getExplanation({
                status: data.status,
                ratio: data.ratio,
                acuteSessions: data.acuteSessions,
                chronicSessions: data.chronicSessions,
                acuteLoad: data.acuteLoad,
                chronicLoad: data.chronicLoad,
              })}
            </p>
          </Card>

          {/* Trend corridor */}
          {data.trend.length > 0 && (
            <Card className="p-[18px]">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-[16px] font-semibold text-text-primary">
                  Corridor · {data.trend.length} weken
                </div>
                <div className="text-[11px] text-text-tertiary">blijf in de groene band</div>
              </div>
              <AcwrCorridor points={data.trend} />
            </Card>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Acute (7d)" value={Math.round(data.acuteLoad)} unit="load" />
            <StatTile label="Chronisch (28d)" value={Math.round(data.chronicLoad)} unit="load" />
            <StatTile
              label="Sessies (7d)"
              value={data.acuteSessions}
              unit={`van ${Math.round(data.chronicSessions / 4) || 7}`}
            />
            <StatTile
              label="Sessies (28d)"
              value={data.chronicSessions}
              unit="totaal"
            />
          </div>

          {/* Per-sport */}
          <SportCorrelations />

          {/* AI insight */}
          <SportInsightCard />

          {/* Explanation card */}
          <Card className="p-[18px]">
            <div className="text-[16px] font-semibold text-text-primary">Wat betekent dit?</div>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
              Je belasting (ACWR) vergelijkt de afgelopen <strong className="text-text-primary">7 dagen</strong> met
              je gemiddelde over <strong className="text-text-primary">28 dagen</strong>.
            </p>
            <ul className="mt-4 space-y-2.5">
              {([
                ['low', 'Te licht', 'onder 0.6 — meerdere weken zo betekent fitness-verlies.'],
                ['optimal', 'In balans', '0.6 – 1.3 — sweet spot, prikkel met ruimte voor herstel.'],
                ['warning', 'Opbouw', '1.3 – 1.5 — actief progressief, blijf alert.'],
                ['danger', 'Overbelast', 'boven 1.5 — fors verhoogd blessurerisico.'],
              ] as Array<[WorkloadStatus, string, string]>).map(([key, label, body]) => (
                <li key={key} className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[key] }}
                  />
                  <p className="text-[13px] text-text-secondary">
                    <span className="font-semibold text-text-primary">{label}</span> · {body}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed text-text-tertiary">
              Je dagelijkse trainingsbelasting is een gewogen som van gym-tonnage, hardloop-afstand en -tempo, en
              padel-tijd. Rustdagen tellen als 0.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
