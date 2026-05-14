'use client'

import { Check } from 'lucide-react'
import { Card } from '@/components/ui/v2'
import { ZoneBar } from '@/components/ui/v2'
import type { WorkloadData, WorkloadStatus } from '@/types/workload'

const STATUS_LABELS: Record<WorkloadStatus, string> = {
  low: 'Te licht',
  optimal: 'In balans',
  warning: 'Opbouw',
  danger: 'Overbelast',
}

const STATUS_COLOR: Record<WorkloadStatus, string> = {
  low: 'rgba(142,142,147,1)',
  optimal: '#22D67A',
  warning: '#FFB020',
  danger: '#FF4D6D',
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

interface RatioCardProps {
  data: WorkloadData
}

export function RatioCard({ data }: RatioCardProps) {
  const color = STATUS_COLOR[data.status]
  const bg = STATUS_BG[data.status]

  return (
    <Card className="p-5 border-bg-border-strong">
      <div className="flex items-start justify-between">
        <div>
          <div
            className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.4px]"
            style={{ color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: color, boxShadow: `0 0 8px ${color}` }}
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
            background: bg,
            border: `1px solid ${color}66`,
            boxShadow: `0 0 20px ${color}4d`,
          }}
        >
          <Check size={22} strokeWidth={2.5} style={{ color }} />
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
  )
}
