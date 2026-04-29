'use client'

import { useEffect, useRef, useState } from 'react'
import type { Database } from '@/types/database'
import { Confetti } from './Confetti'
import { GoalSparkline } from './GoalSparkline'

type GoalRow = Database['public']['Tables']['goals']['Row']

export interface GoalCardProps {
  goal: GoalRow
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  strength: '#2E6F6F',
  running: '#C2410C',
  padel: '#B45309',
  nutrition: '#16A34A',
  general: '#A8A29E',
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
  const categoryColor = CATEGORY_COLORS[goal.category] ?? '#A8A29E'
  const isCompleted = goal.status === 'completed'

  // Confetti: trigger once when this card transitions from active → completed.
  const wasCompletedRef = useRef(isCompleted)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (isCompleted && !wasCompletedRef.current) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 2000)
      return () => clearTimeout(timer)
    }
    wasCompletedRef.current = isCompleted
  }, [isCompleted])

  return (
    <div
      className="relative bg-surface-primary border border-separator rounded-[14px] p-4 overflow-hidden"
      style={{ opacity: isCompleted ? 0.7 : 1 }}
    >
      {showConfetti && <Confetti />}
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
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: '#16A34A22', color: '#16A34A' }}
              >
                Voltooid
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-label-primary">{goal.title}</p>
          {goal.description && (
            <p className="mt-0.5 text-xs text-label-tertiary">{goal.description}</p>
          )}
        </div>

        {!isCompleted && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onComplete(goal.id)}
              title="Voltooien"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-green-500/10"
              style={{ color: '#16A34A' }}
            >
              <CheckIcon />
            </button>
            <button
              onClick={() => onDelete(goal.id)}
              title="Verwijderen"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-label-tertiary transition-colors hover:text-system-red hover:bg-red-500/10"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {goal.target_value !== null && (
        <>
          <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-system-gray6">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: isCompleted ? '#16A34A' : categoryColor }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-label-tertiary">
              {current} / {goal.target_value} {goal.target_unit ?? ''}
            </span>
            <div className="flex items-center gap-2">
              {goal.deadline && (
                <span className="text-xs text-label-tertiary">
                  {formatDeadline(goal.deadline)}
                </span>
              )}
              <span className="text-xs font-medium text-label-primary">
                {pct}%
              </span>
            </div>
          </div>
        </>
      )}

      {goal.category === 'strength' && (
        <GoalSparkline goalId={goal.id} color={categoryColor} enabled={!isCompleted} />
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
