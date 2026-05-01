'use client'

import { X } from 'lucide-react'
import { useReadinessContributors } from '@/hooks/useReadinessContributors'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { Contributor } from '@/app/api/readiness/contributors/route'

interface ReadinessDrilldownSheetProps {
  open: boolean
  onClose: () => void
}

const DIRECTION_COLOR: Record<Contributor['direction'], string> = {
  positive: 'var(--color-status-good)',
  negative: 'var(--color-status-bad)',
  neutral: 'rgba(255,255,255,0.32)',
}

function formatCurrent(c: Contributor): string {
  if (c.current === null) return '—'
  if (c.key === 'sleep') {
    const h = Math.floor(c.current / 60)
    const m = c.current % 60
    return `${h}u ${m}m`
  }
  if (c.key === 'acwr') return c.current.toFixed(2)
  return `${c.current} ${c.unit}`
}

function formatBaseline(c: Contributor): string {
  if (c.baseline30d === null) return 'baseline nog onbekend'
  if (c.key === 'sleep') {
    const h = Math.floor(c.baseline30d / 60)
    const m = c.baseline30d % 60
    return `30d-baseline ${h}u ${m}m`
  }
  if (c.key === 'acwr') return '30d-baseline 1.00 (sweet-spot 0.8–1.3)'
  return `30d-baseline ${c.baseline30d} ${c.unit}`
}

function formatDelta(c: Contributor): string {
  if (c.deltaPct === null) return ''
  const sign = c.deltaPct > 0 ? '+' : ''
  return `${sign}${c.deltaPct}%`
}

function ContributorRow({ c }: { c: Contributor }) {
  const color = DIRECTION_COLOR[c.direction]
  const hasDelta = c.deltaPct !== null
  // Map deltaPct (-50 to +50) onto a 0-100 bar position centered at 50.
  const barPos =
    c.deltaPct === null
      ? 50
      : Math.max(0, Math.min(100, 50 + Math.max(-50, Math.min(50, c.deltaPct))))

  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-subhead font-semibold text-text-primary">{c.label}</span>
        <span className="text-title3 font-bold tabular-nums text-text-primary">
          {formatCurrent(c)}
        </span>
      </div>

      {/* Baseline band */}
      <div
        className="relative mt-3 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        {/* Center marker */}
        <div
          className="absolute top-0 h-full w-px"
          style={{ left: '50%', background: 'rgba(255,255,255,0.18)' }}
        />
        {/* Position dot */}
        {hasDelta && (
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${barPos}%`, background: color }}
          />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-caption1">
        <span className="text-text-tertiary">{formatBaseline(c)}</span>
        {hasDelta && (
          <span className="font-semibold tabular-nums" style={{ color }}>
            {formatDelta(c)}
          </span>
        )}
      </div>
    </div>
  )
}

export function ReadinessDrilldownSheet({ open, onClose }: ReadinessDrilldownSheetProps) {
  useBodyScrollLock(open)
  useEscapeKey(open, onClose)
  const { data, isLoading } = useReadinessContributors(open)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Readiness contributors"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex w-full max-w-md flex-col rounded-t-3xl bg-bg-surface shadow-2xl sm:rounded-3xl max-h-[85dvh] pb-safe">
        <div className="flex items-start justify-between gap-3 border-b border-bg-border px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-headline font-semibold text-text-primary">Wat bepaalt dit?</h2>
            <p className="mt-0.5 text-caption1 text-text-tertiary">
              Vandaag vs jouw 30-daagse baseline.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary hover:bg-white/[0.08]"
            aria-label="Sluiten"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading || !data ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {data.contributors.map((c) => (
                <ContributorRow key={c.key} c={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
