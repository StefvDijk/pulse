'use client'

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

function isRecent(dateStr: string): boolean {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  return diffMs < 7 * 24 * 60 * 60 * 1000
}

export function PRList({ records }: PRListProps) {
  if (records.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm text-text-tertiary">Nog geen persoonlijke records</p>
      </div>
    )
  }

  // Show strength PRs first, then other categories
  const strengthPRs = records.filter((r) => r.record_category === 'strength')
  const otherPRs = records.filter((r) => r.record_category !== 'strength')
  const sorted = [...strengthPRs, ...otherPRs].slice(0, 12)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {sorted.map((pr) => {
        const delta = pr.previous_record !== null ? pr.value - pr.previous_record : null
        const deltaPct =
          delta !== null && pr.previous_record
            ? ((delta / pr.previous_record) * 100).toFixed(0)
            : null
        const recent = isRecent(pr.achieved_at)

        return (
          <div
            key={pr.id}
            className={`relative rounded-2xl p-3.5 ${
              recent
                ? 'bg-system-blue/10 border border-system-blue/20'
                : 'bg-bg-surface border border-bg-border'
            }`}
          >
            {/* NIEUW badge */}
            {recent && (
              <span className="absolute -top-2 right-3 rounded-full bg-system-blue px-2 py-0.5 text-[10px] font-semibold text-white">
                NIEUW
              </span>
            )}

            {/* Exercise name */}
            <p className="text-xs font-medium text-text-primary truncate">
              {pr.exercise_definitions?.name ?? pr.record_type}
            </p>

            {/* PR value */}
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
              {pr.value}
              <span className="text-sm font-normal text-text-tertiary ml-0.5">
                {pr.unit}
              </span>
            </p>

            {/* Delta */}
            {delta !== null && (
              <span
                className={`mt-1 inline-block text-xs font-medium ${
                  delta >= 0 ? 'text-system-green' : 'text-system-red'
                }`}
              >
                {delta >= 0 ? '+' : ''}
                {delta % 1 === 0 ? delta : delta.toFixed(1)}
                {pr.unit}
                {deltaPct ? ` (${delta >= 0 ? '+' : ''}${deltaPct}%)` : ''}
              </span>
            )}

            {/* Date */}
            <p className="mt-1.5 text-[10px] text-text-tertiary">
              {formatDate(pr.achieved_at)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
