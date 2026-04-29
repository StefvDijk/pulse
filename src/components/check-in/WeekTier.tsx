'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronUp, Flame } from 'lucide-react'
import {
  BURN_TIER_LABELS,
  type BurnTierContributor,
  type BurnTierLabel,
} from '@/lib/check-in/burn-tier'

interface BurnTierResponse {
  available: boolean
  reason?: string
  weeksFound?: number
  weekStart?: string
  tier?: BurnTierLabel
  ratio?: number
  position?: number
  colorClass?: string
  currentLoad?: number
  baselineLoad?: number
  weeksInBaseline?: number
  contributors?: BurnTierContributor[]
}

async function fetcher(url: string): Promise<BurnTierResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

interface Props {
  weekStart: string
}

function formatContributor(contributor: BurnTierContributor): string {
  const { current, baseline } = contributor
  if (current == null) return '—'
  const round = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1))
  if (baseline == null) return round(current)
  return `${round(current)} (gem ${round(baseline)})`
}

function contributorBadge(contributor: BurnTierContributor): {
  label: string
  className: string
} | null {
  if (contributor.ratio == null) return null
  const pct = Math.round((contributor.ratio - 1) * 100)
  if (Math.abs(pct) < 5) return { label: '~gemiddeld', className: 'text-text-tertiary' }
  return {
    label: pct > 0 ? `+${pct}%` : `${pct}%`,
    className: pct > 0 ? 'text-[var(--color-status-good)]' : 'text-[var(--color-status-bad)]',
  }
}

export function WeekTier({ weekStart }: Props) {
  const { data, isLoading } = useSWR<BurnTierResponse>(
    `/api/check-in/burn-tier?week_start=${weekStart}`,
    fetcher,
  )
  const [expanded, setExpanded] = useState(false)

  if (isLoading || !data || !data.available) return null

  const tierIndex = BURN_TIER_LABELS.findIndex((l) => l === data.tier)

  return (
    <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={expanded}
      >
        <Flame size={16} className="text-[var(--color-status-warn)]" aria-hidden="true" />
        <h3 className="flex-1 text-subhead font-semibold text-text-primary">
          Burn Bar
        </h3>
        <span className="text-xs text-text-tertiary">vs jouw 4-weken gemiddelde</span>
        {expanded ? (
          <ChevronUp size={14} className="text-text-tertiary" />
        ) : (
          <ChevronDown size={14} className="text-text-tertiary" />
        )}
      </button>

      <p className="mt-3 text-title3 font-bold text-text-primary">{data.tier}</p>

      {/* Tier bar */}
      <div className="relative mt-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="flex-1 bg-[var(--color-status-bad)]/30" />
          <div className="flex-1 bg-[var(--color-status-warn)]/30" />
          <div className="flex-1 bg-[var(--color-status-good)]/30" />
          <div className="flex-1 bg-[#0A84FF]/30" />
          <div className="flex-1 bg-[#A78BFA]/30" />
        </div>
        {/* Round marker */}
        <div
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-primary ${data.colorClass}`}
          style={{ left: `${(data.position ?? 0) * 100}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Tier labels */}
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wide text-text-tertiary">
        {BURN_TIER_LABELS.map((label, i) => (
          <span
            key={label}
            className={`max-w-[18%] text-center leading-tight ${
              i === tierIndex ? 'font-semibold text-text-primary' : ''
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {expanded && data.contributors && (
        <div className="mt-4 flex flex-col gap-2 border-t border-bg-border pt-3">
          <p className="text-caption2 font-semibold uppercase tracking-wider text-text-tertiary">
            Wat woog mee
          </p>
          {data.contributors.map((c) => {
            const badge = contributorBadge(c)
            return (
              <div key={c.metric} className="flex items-center justify-between text-sm">
                <span className="text-text-primary">{c.metric}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-text-secondary tabular-nums">
                    {formatContributor(c)}
                  </span>
                  {badge && (
                    <span className={`text-caption2 tabular-nums ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {data.weeksInBaseline != null && (
            <p className="mt-1 text-caption1 text-text-tertiary">
              Vergeleken met {data.weeksInBaseline} eerdere weken.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
