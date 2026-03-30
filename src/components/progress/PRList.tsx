'use client'

import type { Database } from '@/types/database'

type PRRow = Database['public']['Tables']['personal_records']['Row']

export interface PRListProps {
  records: PRRow[]
}

const CATEGORY_COLORS: Record<string, string> = {
  strength: '#2E6F6F',
  running: '#C2410C',
  padel: '#B45309',
  general: '#A8A29E',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isRecent(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
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

  return (
    <div className="flex flex-col gap-2">
      {records.map((pr) => {
        const delta = pr.previous_record !== null ? pr.value - pr.previous_record : null
        const categoryColor = CATEGORY_COLORS[pr.record_category] ?? '#A8A29E'
        const recent = isRecent(pr.achieved_at)

        return (
          <div
            key={pr.id}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${
              recent ? '' : 'bg-bg-subtle border-border-light'
            }`}
            style={recent ? {
              backgroundColor: '#E6F0F0',
              borderColor: '#2E6F6F33',
            } : undefined}
          >
            <div className="flex items-center gap-2 min-w-0">
              {recent && (
                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#2E6F6F22', color: '#2E6F6F' }}>
                  NIEUW
                </span>
              )}
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                style={{ backgroundColor: `${categoryColor}22`, color: categoryColor }}
              >
                {pr.record_category}
              </span>
              <span className="truncate text-sm font-medium text-text-primary">
                {pr.record_type}
              </span>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5 pl-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  {pr.value} {pr.unit}
                </span>
                {delta !== null && (
                  <span
                    className="text-xs"
                    style={{ color: delta >= 0 ? '#16A34A' : '#DC2626' }}
                  >
                    {delta >= 0 ? '+' : ''}{delta.toFixed(delta % 1 === 0 ? 0 : 1)}
                  </span>
                )}
              </div>
              <span className="hidden text-xs text-text-tertiary sm:block">
                {formatDate(pr.achieved_at)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
