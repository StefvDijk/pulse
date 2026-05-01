'use client'

import { Activity, Flame, Footprints, Heart, HeartPulse } from 'lucide-react'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'

interface VitalsCardProps {
  data: CheckInReviewData
}

interface MetricBlock {
  key: string
  icon: typeof Footprints
  label: string
  value: string
  delta: { text: string; tone: 'good' | 'bad' | 'neutral' } | null
}

function tone(diff: number, betterDirection: 'up' | 'down' | 'neutral'): 'good' | 'bad' | 'neutral' {
  if (Math.abs(diff) < 0.5) return 'neutral'
  if (betterDirection === 'neutral') return 'neutral'
  const isUp = diff > 0
  const isPositive = betterDirection === 'up' ? isUp : !isUp
  return isPositive ? 'good' : 'bad'
}

function deltaFor(
  current: number | null,
  previous: number | null,
  unit: string,
  betterDirection: 'up' | 'down' | 'neutral',
): { text: string; tone: 'good' | 'bad' | 'neutral' } | null {
  if (current == null || previous == null || previous === 0) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.5) return { text: 'gelijk', tone: 'neutral' }
  const sign = diff > 0 ? '+' : ''
  return {
    text: `${sign}${Math.round(diff)}${unit}`,
    tone: tone(diff, betterDirection),
  }
}

const TONE_COLOR: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'var(--color-status-good)',
  bad: 'var(--color-status-warn)',
  neutral: 'var(--color-text-tertiary)',
}

function fmtNum(n: number | null, suffix = ''): string {
  if (n == null) return '–'
  return `${Math.round(n).toLocaleString('nl-NL')}${suffix}`
}

function StepsSparkline({ days }: { days: CheckInReviewData['vitals'] extends infer T ? T extends { days: infer D } ? D : never : never }) {
  const safeDays = days as Array<{ date: string; steps: number | null }>
  const values = safeDays.map((d) => d.steps ?? 0)
  if (values.length === 0) return null
  const max = Math.max(...values, 1)

  return (
    <div className="mt-3 flex items-end gap-1 h-8">
      {safeDays.map((d, i) => {
        const v = d.steps ?? 0
        const heightPct = max > 0 ? (v / max) * 100 : 0
        const dayLabel = new Date(d.date + 'T00:00:00Z').toLocaleDateString('nl-NL', {
          weekday: 'narrow',
          timeZone: 'UTC',
        })
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(heightPct, 4)}%`,
                background: v > 0 ? '#0A84FF' : 'rgba(255,255,255,0.06)',
                opacity: v > 0 ? 0.85 : 1,
              }}
              title={`${dayLabel}: ${v.toLocaleString('nl-NL')} stappen`}
            />
            <span className="text-[9px] text-text-tertiary">{dayLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

export function VitalsCard({ data }: VitalsCardProps) {
  const v = data.vitals
  if (!v) return null

  const prev = data.previousWeek
  const blocks: MetricBlock[] = []

  if (v.avgSteps != null) {
    blocks.push({
      key: 'steps',
      icon: Footprints,
      label: 'Stappen/dag',
      value: fmtNum(v.avgSteps),
      delta: deltaFor(v.avgSteps, prev?.avgSteps ?? null, '', 'up'),
    })
  }
  if (v.avgActiveCalories != null) {
    blocks.push({
      key: 'active',
      icon: Flame,
      label: 'Actief kcal',
      value: fmtNum(v.avgActiveCalories),
      delta: deltaFor(v.avgActiveCalories, prev?.avgActiveCalories ?? null, '', 'up'),
    })
  }
  if (v.avgRestingHr != null) {
    blocks.push({
      key: 'rhr',
      icon: Heart,
      label: 'Rust-HR',
      value: fmtNum(v.avgRestingHr, ' bpm'),
      // Lower RHR = better recovery
      delta: deltaFor(v.avgRestingHr, prev?.avgRestingHr ?? null, '', 'down'),
    })
  }
  if (v.avgHrv != null) {
    blocks.push({
      key: 'hrv',
      icon: HeartPulse,
      label: 'HRV',
      value: fmtNum(v.avgHrv, ' ms'),
      delta: deltaFor(v.avgHrv, prev?.avgHrv ?? null, '', 'up'),
    })
  }

  if (blocks.length === 0) return null

  const hasSteps = v.daysWithSteps >= 2

  return (
    <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity size={14} className="text-text-tertiary" />
        <h3 className="text-subhead font-semibold text-text-primary">Vitalen</h3>
        <span className="text-[11px] text-text-tertiary">uit Apple Health</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {blocks.map((b) => {
          const Icon = b.icon
          return (
            <div key={b.key} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <Icon size={11} className="text-text-tertiary" />
                <span className="text-[11px] text-text-tertiary">{b.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-semibold tabular-nums text-text-primary">{b.value}</span>
                {b.delta && (
                  <span className="text-[10px] tabular-nums" style={{ color: TONE_COLOR[b.delta.tone] }}>
                    {b.delta.text}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {hasSteps && <StepsSparkline days={v.days} />}
    </div>
  )
}
