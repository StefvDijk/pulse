'use client'

import { useState, useMemo } from 'react'
import type { Database } from '@/types/database'

type PRRow = Database['public']['Tables']['personal_records']['Row'] & {
  exercise_definitions?: { name: string } | null
}

export interface PRListProps {
  records: PRRow[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  })
}

function isRecent(dateStr: string, days = 7): boolean {
  return Date.now() - new Date(dateStr).getTime() < days * 24 * 60 * 60 * 1000
}

function isTonnage(pr: PRRow): boolean {
  const t = (pr.record_type ?? '').toLowerCase()
  return t.includes('tonnage') || t.includes('volume')
}

function PRCard({ pr, highlight }: { pr: PRRow; highlight?: boolean }) {
  const delta = pr.previous_record !== null ? pr.value - pr.previous_record : null
  const deltaPct =
    delta !== null && pr.previous_record
      ? ((delta / pr.previous_record) * 100).toFixed(0)
      : null

  return (
    <div
      className={`relative rounded-2xl p-3.5 ${
        highlight
          ? 'bg-[#0A84FF]/10 border border-[#0A84FF]/30'
          : 'bg-bg-surface border border-bg-border'
      }`}
    >
      {highlight && (
        <span className="absolute -top-2 right-3 rounded-full bg-[#0A84FF] px-2 py-0.5 text-[10px] font-semibold text-white">
          NIEUW
        </span>
      )}

      <p className="truncate text-xs font-medium text-text-primary">
        {pr.exercise_definitions?.name ?? pr.record_type}
      </p>

      <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
        {pr.value}
        <span className="ml-0.5 text-sm font-normal text-text-tertiary">
          {pr.unit}
        </span>
      </p>

      {delta !== null && (
        <span
          className={`mt-1 inline-block text-xs font-medium ${
            delta >= 0
              ? 'text-[var(--color-status-good)]'
              : 'text-[var(--color-status-bad)]'
          }`}
        >
          {delta >= 0 ? '+' : ''}
          {delta % 1 === 0 ? delta : delta.toFixed(1)}
          {pr.unit}
          {deltaPct ? ` (${delta >= 0 ? '+' : ''}${deltaPct}%)` : ''}
        </span>
      )}

      <p className="mt-1.5 text-[10px] text-text-tertiary">
        {formatDate(pr.achieved_at)}
      </p>
    </div>
  )
}

export function PRList({ records }: PRListProps) {
  const [showAll, setShowAll] = useState(false)
  const [includeTonnage, setIncludeTonnage] = useState(false)

  const { highlights, others } = useMemo(() => {
    const strength = records.filter((r) => r.record_category === 'strength' && !isTonnage(r))
    const recentStrength = strength
      .filter((r) => isRecent(r.achieved_at, 7))
      .sort((a, b) => {
        const ap = a.previous_record ? (a.value - a.previous_record) / a.previous_record : 0
        const bp = b.previous_record ? (b.value - b.previous_record) / b.previous_record : 0
        return bp - ap
      })
      .slice(0, 3)

    const recentIds = new Set(recentStrength.map((r) => r.id))
    const rest = records.filter((r) => !recentIds.has(r.id))

    return { highlights: recentStrength, others: rest }
  }, [records])

  const visibleOthers = useMemo(() => {
    return includeTonnage ? others : others.filter((r) => !isTonnage(r))
  }, [others, includeTonnage])

  if (records.length === 0) {
    return (
      <p className="py-2 text-caption1 text-text-tertiary">
        Nog geen persoonlijke records.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Highlights deze week */}
      {highlights.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-caption1 font-semibold text-text-secondary">
            Deze week
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {highlights.map((pr) => (
              <PRCard key={pr.id} pr={pr} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Alle records — collapsible */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex items-center justify-between text-left"
        >
          <span className="text-caption1 font-semibold text-text-secondary">
            Alle records ({visibleOthers.length})
          </span>
          <span className="text-caption2 text-text-tertiary">
            {showAll ? 'Verbergen' : 'Toon alles'}
          </span>
        </button>

        {showAll && (
          <>
            <label className="flex items-center gap-2 text-caption2 text-text-tertiary">
              <input
                type="checkbox"
                checked={includeTonnage}
                onChange={(e) => setIncludeTonnage(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#0A84FF]"
              />
              Tonnage-records meenemen
            </label>

            {visibleOthers.length === 0 ? (
              <p className="text-caption2 text-text-tertiary">
                Geen records in deze categorie.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {visibleOthers.map((pr) => (
                  <PRCard key={pr.id} pr={pr} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
