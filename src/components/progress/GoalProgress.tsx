'use client'

import type { Database } from '@/types/database'

type GoalRow = Database['public']['Tables']['goals']['Row']

export interface GoalProgressProps {
  goals: GoalRow[]
}

const CATEGORY_COLORS: Record<string, string> = {
  strength: '#8b5cf6',
  running: '#06b6d4',
  padel: '#f59e0b',
  nutrition: '#22c55e',
  general: '#8888a0',
}

function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'Verlopen'
  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Morgen'
  if (diffDays < 7) return `${diffDays} dagen`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weken`
  return `${Math.ceil(diffDays / 30)} maanden`
}

export function GoalProgress({ goals }: GoalProgressProps) {
  if (goals.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm" style={{ color: '#8888a0' }}>Geen actieve doelen</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {goals.map((goal) => {
        const current = goal.current_value ?? 0
        const target = goal.target_value ?? 1
        const pct = Math.min(100, Math.round((current / target) * 100))
        const categoryColor = CATEGORY_COLORS[goal.category] ?? '#8888a0'

        return (
          <div
            key={goal.id}
            className="rounded-lg p-3"
            style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                  style={{ backgroundColor: `${categoryColor}22`, color: categoryColor }}
                >
                  {goal.category}
                </span>
                <span className="truncate text-sm font-medium" style={{ color: '#f0f0f5' }}>
                  {goal.title}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {goal.deadline && (
                  <span className="text-xs" style={{ color: '#8888a0' }}>
                    {formatDeadline(goal.deadline)}
                  </span>
                )}
                <span className="text-xs font-medium" style={{ color: '#f0f0f5' }}>
                  {pct}%
                </span>
              </div>
            </div>

            <div className="mb-1 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: '#1a1a2e' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: categoryColor }}
              />
            </div>

            {goal.target_value !== null && (
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: '#8888a0' }}>
                  {current} {goal.target_unit ?? ''}
                </span>
                <span className="text-xs" style={{ color: '#8888a0' }}>
                  {target} {goal.target_unit ?? ''}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
