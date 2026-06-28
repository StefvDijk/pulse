'use client'

import { useSleepScore } from '@/hooks/useSleepScore'
import type { SleepComponentKey, SleepScoreResult } from '@/lib/sleep/score'

const ACCENT = '#00E5C7' // gym/sleep accent
const TRACK = 'rgba(0, 229, 199, 0.18)'

const COMPONENT_LABELS: Record<SleepComponentKey, string> = {
  duration: 'Duur',
  bedtime: 'Bedtijd',
  interruptions: 'Onderbrekingen',
  stages: 'Stadia',
}

const TIER_LABEL: Record<SleepScoreResult['tier'], string> = {
  1: 'Alleen slaapduur — sync meer nachten voor het volledige beeld',
  2: 'Bedtijd-baseline wordt nog opgebouwd',
  3: 'Volledige score',
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface SleepRingProps {
  score: number
  provisional: boolean
  size?: number
}

function SleepRing({ score, provisional, size = 132 }: SleepRingProps) {
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100)
  const center = size / 2

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={TRACK} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ACCENT}
          strokeWidth={stroke}
          strokeDasharray={provisional ? '4 6' : circumference}
          strokeDashoffset={provisional ? 0 : dashOffset}
          strokeLinecap="round"
          opacity={provisional ? 0.7 : 1}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-large-title font-semibold tabular-nums text-text-primary">
          {score}
          {provisional && <span aria-hidden className="text-text-tertiary">*</span>}
        </span>
        <span className="text-caption2 uppercase tracking-wide text-text-tertiary">slaapscore</span>
      </div>
    </div>
  )
}

interface ComponentBarProps {
  label: string
  scored: number
  available: number
  skipped: boolean
}

function ComponentBar({ label, scored, available, skipped }: ComponentBarProps) {
  const pct = !skipped && available > 0 ? Math.round((scored / available) * 100) : null

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-caption1 text-text-secondary">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: TRACK }}>
        {pct !== null && (
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: ACCENT, transition: 'width 600ms ease-out' }}
          />
        )}
      </div>
      <span className="w-20 shrink-0 text-right text-caption1 tabular-nums text-text-tertiary">
        {pct !== null ? `${pct}%` : 'nog niet'}
      </span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function SleepScoreCard() {
  const { data, isLoading } = useSleepScore()

  if (isLoading || !data) return null

  if (data.score === null) {
    return (
      <div className="rounded-2xl border border-bg-border bg-white/[0.04] p-4">
        <span className="text-subhead font-semibold text-text-primary">Slaap</span>
        <p className="mt-2 text-caption1 text-text-tertiary">
          Nog geen slaap geïmporteerd. Sync je Apple Health om je slaapscore te zien.
        </p>
      </div>
    )
  }

  const provisional = data.tier < 3

  return (
    <div className="rounded-2xl border border-bg-border bg-white/[0.04] p-4">
      <div className="flex items-center justify-between">
        <span className="text-subhead font-semibold text-text-primary">Slaap</span>
        <span className="text-caption2 uppercase tracking-wide text-text-tertiary">
          afgelopen nacht
        </span>
      </div>

      <div className="mt-4 flex justify-center">
        <SleepRing score={data.score} provisional={provisional} />
      </div>

      <p className="mt-3 text-center text-caption1 text-text-tertiary" aria-live="polite">
        {TIER_LABEL[data.tier]}
      </p>

      <div className="mt-4 space-y-2">
        {data.components.map((c) => (
          <ComponentBar
            key={c.key}
            label={COMPONENT_LABELS[c.key]}
            scored={c.scored}
            available={c.available}
            skipped={c.skipped}
          />
        ))}
      </div>
    </div>
  )
}
