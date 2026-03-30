'use client'

import type { Database } from '@/types/database'

type PRRow = Database['public']['Tables']['personal_records']['Row']

export interface PRListProps {
  records: PRRow[]
}

const CATEGORY_COLORS: Record<string, string> = {
  strength: '#8b5cf6',
  running: '#06b6d4',
  padel: '#f59e0b',
  general: '#8888a0',
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
        <p className="text-sm" style={{ color: '#8888a0' }}>Nog geen persoonlijke records</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {records.map((pr) => {
        const delta = pr.previous_record !== null ? pr.value - pr.previous_record : null
        const categoryColor = CATEGORY_COLORS[pr.record_category] ?? '#8888a0'
        const recent = isRecent(pr.achieved_at)

        return (
          <div
            key={pr.id}
            className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{
              backgroundColor: recent ? 'rgba(79, 140, 255, 0.08)' : '#12121a',
              border: `1px solid ${recent ? 'rgba(79, 140, 255, 0.3)' : '#1a1a2e'}`,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {recent && (
                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: '#4f8cff22', color: '#4f8cff' }}>
                  NIEUW
                </span>
              )}
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                style={{ backgroundColor: `${categoryColor}22`, color: categoryColor }}
              >
                {pr.record_category}
              </span>
              <span className="truncate text-sm font-medium" style={{ color: '#f0f0f5' }}>
                {pr.record_type}
              </span>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5 pl-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: '#f0f0f5' }}>
                  {pr.value} {pr.unit}
                </span>
                {delta !== null && (
                  <span
                    className="text-xs"
                    style={{ color: delta >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {delta >= 0 ? '+' : ''}{delta.toFixed(delta % 1 === 0 ? 0 : 1)}
                  </span>
                )}
              </div>
              <span className="hidden text-xs sm:block" style={{ color: '#8888a0' }}>
                {formatDate(pr.achieved_at)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
