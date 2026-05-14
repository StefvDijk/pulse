'use client'

import { useState } from 'react'
import { NavBar } from '@/components/ui/NavBar'
import { useGoals } from '@/hooks/useGoals'
import { GoalCard } from './GoalCard'
import { GoalForm } from './GoalForm'
import { Card } from '@/components/ui/v2'
import { SkeletonCard, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { QuarterHeroCard } from './v2/QuarterHeroCard'
import { CompletedToggle } from './v2/CompletedToggle'
import { GoalsEmptyState } from './v2/GoalsEmptyState'
import type { Database } from '@/types/database'

type GoalRow = Database['public']['Tables']['goals']['Row']

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-white"
      style={{ background: '#0A84FF', boxShadow: '0 4px 14px rgba(10,132,255,0.4)' }}
      aria-label="Doel toevoegen"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
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

export function GoalsPage() {
  const { goals, isLoading, error, refresh } = useGoals()
  const [showForm, setShowForm] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const activeGoals = goals.filter((g) => g.status !== 'completed')
  const completedGoals = goals.filter((g) => g.status === 'completed')
  const totalCount = activeGoals.length + completedGoals.length

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
    <>
      <NavBar
        variant="inline"
        title="Doelen"
        trailing={<AddButton onClick={() => setShowForm(true)} />}
      />

      <div className="flex flex-col gap-3.5 px-4 pb-24 pt-4">
        {/* Large title + subtitle */}
        <div>
          <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Doelen</h1>
          <div className="mt-0.5 text-[13px] text-text-tertiary">
            {activeGoals.length} actief · {completedGoals.length} voltooid
          </div>
        </div>

        {totalCount > 0 && (
          <QuarterHeroCard
            completedCount={completedGoals.length}
            totalCount={totalCount}
            activeCount={activeGoals.length}
          />
        )}

        {error && <ErrorAlert message="Kon doelen niet laden." onRetry={refresh} />}

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
              <GoalsEmptyState onAdd={() => setShowForm(true)} />
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
                <CompletedToggle
                  count={completedGoals.length}
                  open={showCompleted}
                  onToggle={() => setShowCompleted((v) => !v)}
                />
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
    </>
  )
}
