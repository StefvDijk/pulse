'use client'

import { useState } from 'react'
import { useGoals } from '@/hooks/useGoals'
import { GoalCard } from './GoalCard'
import { GoalForm } from './GoalForm'
import { Card } from '@/components/ui/v2'
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

  // Quarter snapshot
  const totalCount = activeGoals.length + completedGoals.length
  const quarterPct = totalCount > 0 ? Math.round((completedGoals.length / totalCount) * 100) : 0

  return (
    <div className="flex flex-col gap-3.5 px-4 pb-24 pt-[60px]">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Doelen</h1>
          <div className="mt-0.5 text-[13px] text-text-tertiary">
            {activeGoals.length} actief · {completedGoals.length} voltooid
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white"
          style={{
            background: '#0A84FF',
            boxShadow: '0 4px 14px rgba(10,132,255,0.4)',
          }}
          aria-label="Doel toevoegen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Quarter hero */}
      {totalCount > 0 && (
        <div
          className="rounded-[22px] border-[0.5px] p-[18px]"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,229,199,0.10))',
            borderColor: 'rgba(124,58,237,0.30)',
          }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.4px]" style={{ color: '#A78BFA' }}>
            Kwartaalvoortgang
          </div>
          <div className="mt-1 text-[22px] font-bold leading-[1.2] tracking-[-0.4px] text-text-primary">
            {completedGoals.length} van {totalCount} doelen
            <br />
            voltooid
          </div>
          <div className="mt-3.5 h-2 overflow-hidden rounded-[4px] bg-white/[0.06]">
            <div
              className="h-full rounded-[4px]"
              style={{
                width: `${quarterPct}%`,
                background: 'linear-gradient(90deg, #7C3AED, #00E5C7)',
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-text-tertiary">
            <span>{quarterPct}% voltooid</span>
            <span>{activeGoals.length} actief</span>
          </div>
        </div>
      )}

      {error && <ErrorAlert message="Kon doelen niet laden." onRetry={refresh} />}

      {/* New goal form */}
      {showForm && (
        <Card className="p-4">
          <h2 className="mb-3 text-[15px] font-semibold text-text-primary">Nieuw doel</h2>
          <GoalForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        </Card>
      )}

      {isLoading ? (
        <GoalsSkeleton />
      ) : (
        <>
          {activeGoals.length === 0 && !showForm ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-10">
              <TargetIcon />
              <p className="text-[13px] text-text-tertiary">Nog geen actieve doelen</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-[13px] font-medium text-[#0A84FF]"
              >
                + Voeg je eerste doel toe
              </button>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
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

          {completedGoals.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-2 text-[13px] font-medium text-text-tertiary"
              >
                <ChevronIcon open={showCompleted} />
                Voltooid ({completedGoals.length})
              </button>
              {showCompleted && (
                <div className="mt-3 flex flex-col gap-2.5">
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
    <div className="flex flex-col gap-2.5">
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

function TargetIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-text-muted">
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
