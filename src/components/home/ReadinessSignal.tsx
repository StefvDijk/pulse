'use client'

import Link from 'next/link'
import { useReadinessSummary } from '@/hooks/useReadinessSummary'
import { CoachOrb, type CoachOrbState } from '@/components/shared/CoachOrb'
import type { ReadinessSummary } from '@/app/api/readiness/summary/route'

type ReadinessLevel = ReadinessSummary['level']

interface LevelConfig {
  label: string
  orbState: CoachOrbState
  bgClass: string
  textClass: string
  ringColor: string
  trackColor: string
}

const LEVEL_CONFIG: Record<ReadinessLevel, LevelConfig> = {
  good: {
    label: 'Goed hersteld',
    orbState: 'ready',
    bgClass: 'bg-system-green/10',
    textClass: 'text-system-green',
    ringColor: 'var(--color-status-good)',
    trackColor: 'rgba(34, 214, 122, 0.18)',
  },
  normal: {
    label: 'Klaar om te trainen',
    orbState: 'warning',
    bgClass: 'bg-system-orange/10',
    textClass: 'text-system-orange',
    ringColor: 'var(--color-status-warn)',
    trackColor: 'rgba(255, 176, 32, 0.18)',
  },
  fatigued: {
    label: 'Vermoeid',
    orbState: 'alert',
    bgClass: 'bg-system-red/10',
    textClass: 'text-system-red',
    ringColor: 'var(--color-status-bad)',
    trackColor: 'rgba(255, 77, 109, 0.18)',
  },
  rest_day: {
    label: 'Rustdag',
    orbState: 'idle',
    bgClass: 'bg-system-gray6',
    textClass: 'text-text-secondary',
    ringColor: 'var(--color-brand-claude)',
    trackColor: 'rgba(217, 119, 87, 0.18)',
  },
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number
  ringColor: string
  trackColor: string
  size?: number
}

function ScoreRing({ score, ringColor, trackColor, size = 132 }: ScoreRingProps) {
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100)
  const center = size / 2

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-large-title font-semibold tabular-nums text-text-primary">
          {score}
        </span>
        <span className="text-caption2 uppercase tracking-wide text-text-tertiary">
          readiness
        </span>
      </div>
    </div>
  )
}

interface BreakdownBarProps {
  label: string
  value: number | null
  color: string
  trackColor: string
}

function BreakdownBar({ label, value, color, trackColor }: BreakdownBarProps) {
  const hasValue = value !== null
  const pct = hasValue ? Math.max(0, Math.min(100, value)) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-caption1 text-text-secondary">{label}</span>
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: trackColor }}
      >
        {hasValue && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: color,
              transition: 'width 600ms ease-out',
            }}
          />
        )}
      </div>
      <span className="w-10 shrink-0 text-right text-caption1 tabular-nums text-text-tertiary">
        {hasValue ? `${pct}%` : '—'}
      </span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ReadinessSignal() {
  const { data, isLoading } = useReadinessSummary()

  if (isLoading || !data) return null

  const config = LEVEL_CONFIG[data.level]
  const acwrLabel = data.acwr !== null ? `ACWR ${data.acwr.toFixed(2)}` : null

  return (
    <div className={`rounded-2xl border border-bg-border ${config.bgClass} p-4`}>
      {/* Header: orb + label */}
      <div className="flex items-center gap-2.5">
        <CoachOrb size={16} state={config.orbState} />
        <span className={`text-subhead font-semibold ${config.textClass}`}>
          {config.label}
        </span>
      </div>

      {/* Coach sentence */}
      <p className="mt-3 text-subhead leading-snug text-text-primary">
        {data.sentence}
      </p>

      {/* Hero score ring */}
      <div className="mt-4 flex justify-center">
        <ScoreRing
          score={data.score}
          ringColor={config.ringColor}
          trackColor={config.trackColor}
        />
      </div>

      {/* Metric breakdown */}
      <div className="mt-4 space-y-2">
        <BreakdownBar
          label="Slaap"
          value={data.breakdown.sleep}
          color={config.ringColor}
          trackColor={config.trackColor}
        />
        <BreakdownBar
          label="HRV"
          value={data.breakdown.hrv}
          color={config.ringColor}
          trackColor={config.trackColor}
        />
        <BreakdownBar
          label="RHR"
          value={data.breakdown.rhr}
          color={config.ringColor}
          trackColor={config.trackColor}
        />
      </div>

      {/* ACWR drilldown link */}
      {acwrLabel && (
        <div className="mt-3 text-caption1 text-text-tertiary">
          <Link
            href="/belasting"
            className="text-system-blue transition-opacity active:opacity-60"
          >
            {acwrLabel}
          </Link>
        </div>
      )}
    </div>
  )
}
