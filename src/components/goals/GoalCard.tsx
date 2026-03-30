'use client'

import type { Database } from '@/types/database'

type GoalRow = Database['public']['Tables']['goals']['Row']

export interface GoalCardProps {
  goal: GoalRow
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  strength: '#8b5cf6',
  running: '#06b6d4',
  padel: '#f59e0b',
  nutrition: '#22c55e',
  general: '#8888a0',
}

const CATEGORY_LABELS: Record<string, string> = {
  strength: 'Kracht',
  running: 'Hardlopen',
  padel: 'Padel',
  nutrition: 'Voeding',
  general: 'Algemeen',
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
  return `${Math.ceil(diffDays / 30)} mnd`
}

export function GoalCard({ goal, onComplete, onDelete }: GoalCardProps) {
  const current = goal.current_value ?? 0
  const target = goal.target_value ?? 1
  const pct = Math.min(100, Math.round((current / target) * 100))
  const categoryColor = CATEGORY_COLORS[goal.category] ?? '#8888a0'
  const isCompleted = goal.status === 'completed'

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: '#12121a',
        border: '1px solid #1a1a2e',
        opacity: isCompleted ? 0.7 : 1,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
              style={{ backgroundColor: `${categoryColor}22`, color: categoryColor }}
            >
              {CATEGORY_LABELS[goal.category] ?? goal.category}
            </span>
            {isCompleted && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: '#22c55e22', color: '#22c55e' }}>
                Voltooid
              </span>
            )}
          </div>
          <p className="text-sm font-medium" style={{ color: '#f0f0f5' }}>{goal.title}</p>
          {goal.description && (
            <p className="mt-0.5 text-xs" style={{ color: '#8888a0' }}>{goal.description}</p>
          )}
        </div>

        {!isCompleted && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onComplete(goal.id)}
              title="Voltooien"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-green-500/10"
              style={{ color: '#22c55e' }}
            >
              <CheckIcon />
            </button>
            <button
              onClick={() => onDelete(goal.id)}
              title="Verwijderen"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
              style={{ color: '#8888a0' }}
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {goal.target_value !== null && (
        <>
          <div className="mb-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: '#1a1a2e' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: isCompleted ? '#22c55e' : categoryColor }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#8888a0' }}>
              {current} / {goal.target_value} {goal.target_unit ?? ''}
            </span>
            <div className="flex items-center gap-2">
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
        </>
      )}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5 3.5V2h4v1.5M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
