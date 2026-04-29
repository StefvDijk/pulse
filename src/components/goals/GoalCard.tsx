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

interface CatTone {
  base: string
  light: string
}

const CATEGORY_TONE: Record<string, CatTone> = {
  strength: { base: '#00E5C7', light: 'rgba(0,229,199,0.18)' },
  running: { base: '#FF5E3A', light: 'rgba(255,94,58,0.18)' },
  padel: { base: '#FFB020', light: 'rgba(255,176,32,0.18)' },
  nutrition: { base: '#9CFF4F', light: 'rgba(156,255,79,0.18)' },
  general: { base: '#A78BFA', light: 'rgba(167,139,250,0.18)' },
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
  const tone = CATEGORY_TONE[goal.category] ?? CATEGORY_TONE.general
  const isCompleted = goal.status === 'completed'

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
      className="relative overflow-hidden rounded-[18px] border-[0.5px] border-bg-border bg-bg-surface p-4"
      style={{ opacity: isCompleted ? 0.7 : 1 }}
    >
      {showConfetti && <Confetti />}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px]"
              style={{ background: tone.light, color: tone.base }}
            >
              {CATEGORY_LABELS[goal.category] ?? goal.category}
            </span>
            {isCompleted && (
              <span
                className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(34,214,122,0.18)', color: '#22D67A' }}
              >
                Voltooid
              </span>
            )}
          </div>
          <div className="text-[16px] font-semibold tracking-[-0.2px] text-text-primary">{goal.title}</div>
          {goal.description && <div className="mt-0.5 text-[12px] text-text-tertiary">{goal.description}</div>}
        </div>
        {goal.deadline && (
          <div className="text-[11px] text-text-tertiary">{formatDeadline(goal.deadline)}</div>
        )}
      </div>

      {goal.target_value !== null && (
        <>
          <div className="mt-3 flex items-baseline gap-1.5">
            <div className="text-[24px] font-bold tracking-[-0.5px] tabular-nums text-text-primary">{current}</div>
            <div className="text-[13px] text-text-tertiary tabular-nums">
              / {goal.target_value} {goal.target_unit ?? ''}
            </div>
            <div
              className="ml-auto text-[13px] font-semibold tabular-nums"
              style={{ color: isCompleted ? '#22D67A' : tone.base }}
            >
              {pct}%
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-[3px] bg-white/[0.06]">
            <div
              className="h-full rounded-[3px] transition-all"
              style={{
                width: `${pct}%`,
                background: isCompleted ? '#22D67A' : tone.base,
                boxShadow: `0 0 8px ${isCompleted ? '#22D67A' : tone.base}`,
              }}
            />
          </div>
        </>
      )}

      {goal.category === 'strength' && (
        <GoalSparkline goalId={goal.id} color={tone.base} enabled={!isCompleted} />
      )}

      {!isCompleted && (
        <div className="mt-3 flex justify-end gap-1">
          <button
            onClick={() => onComplete(goal.id)}
            title="Voltooien"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#22D67A] hover:bg-white/[0.06]"
          >
            <CheckIcon />
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            title="Verwijderen"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-white/[0.06] hover:text-[var(--color-status-bad)]"
          >
            <TrashIcon />
          </button>
        </div>
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
