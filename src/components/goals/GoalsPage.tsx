'use client'

import { useState } from 'react'
import { useGoals } from '@/hooks/useGoals'
import { GoalCard } from './GoalCard'
import { GoalForm } from './GoalForm'
import { SkeletonCard, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import type { Database } from '@/types/database'

type GoalRow = Database['public']['Tables']['goals']['Row']

export function GoalsPage() {
  const { goals, isLoading, error, refresh } = useGoals()
  const [showForm, setShowForm] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const activeGoals = goals.filter((g) => g.status !== 'completed')
  const completedGoals = goals.filter((g) => g.status === 'completed')

  async function handleComplete(id: string) {
    await fetch(`/api/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    refresh()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    refresh()
  }

  function handleSave(goal: GoalRow) {
    void goal
    setShowForm(false)
    refresh()
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-label-primary">Doelen</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-system-blue text-white"
        >
          <PlusIcon />
          Doel toevoegen
        </button>
      </div>

      {error && <ErrorAlert message="Kon doelen niet laden." onRetry={refresh} />}

      {/* Add goal form */}
      {showForm && (
        <div className="bg-surface-primary border border-separator rounded-[14px] p-[14px_16px]">
          <h2 className="mb-4 text-sm font-semibold text-label-primary">Nieuw doel</h2>
          <GoalForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {isLoading ? (
        <GoalsSkeleton />
      ) : (
        <>
          {/* Active goals */}
          {activeGoals.length === 0 && !showForm ? (
            <div className="flex flex-col items-center justify-center gap-3 bg-surface-primary border border-separator rounded-[14px] p-10">
              <TargetIcon />
              <p className="text-sm text-label-tertiary">Nog geen actieve doelen</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-sm font-medium text-system-blue"
              >
                + Voeg je eerste doel toe
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Completed goals (collapsed) */}
          {completedGoals.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-label-tertiary"
              >
                <ChevronIcon open={showCompleted} />
                Voltooid ({completedGoals.length})
              </button>

              {showCompleted && (
                <div className="mt-3 flex flex-col gap-3">
                  {completedGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onComplete={handleComplete}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GoalsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="flex flex-col gap-3">
          <SkeletonRect height="h-4" />
          <SkeletonRect height="h-3" />
          <SkeletonRect height="h-2" />
        </SkeletonCard>
      ))}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-label-tertiary">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
    >
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
