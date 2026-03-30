'use client'

import { useMemo } from 'react'
import { useDashboardData } from '@/hooks/useDashboardData'
import { WorkloadMeter, type WorkloadStatus } from './WorkloadMeter'
import { MuscleHeatmap } from './MuscleHeatmap'
import { SportSplit } from './SportSplit'
import { AdherenceTracker } from './AdherenceTracker'
import { TrainingBlockIndicator } from './TrainingBlockIndicator'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'

function getIsoWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-1/3" />
        <div className="flex justify-center py-2">
          <div className="h-24 w-24 rounded-full bg-bg-subtle" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SkeletonRect height="h-10" />
          <SkeletonRect height="h-10" />
          <SkeletonRect height="h-10" />
        </div>
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-1/3" />
        <SkeletonRect height="h-20" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3 lg:col-span-2">
        <SkeletonLine width="w-1/4" />
        <div className="flex gap-2">
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="h-10 flex-1 rounded-full bg-bg-subtle" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3 lg:col-span-2">
        <SkeletonLine width="w-1/4" />
        <SkeletonRect height="h-40" />
      </SkeletonCard>
    </div>
  )
}

function DashboardCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-bg-card border border-border-light rounded-[14px] p-[14px_16px] ${className ?? ''}`}
    >
      <h2 className="mb-4 text-[17px] font-semibold text-text-primary">
        {title}
      </h2>
      {children}
    </div>
  )
}

export function DashboardPage() {
  const { data, error, isLoading, refresh } = useDashboardData()
  const weekStart = useMemo(() => getIsoWeekStart(new Date()), [])

  if (isLoading || !data) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorAlert message="Kan dashboard niet laden." onRetry={refresh} />
      </div>
    )
  }

  const isEmpty = !data.weeklyAggregation && data.dailyAggregations.length === 0

  if (isEmpty) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<DumbbellIcon />}
          title="Start je eerste workout om je dashboard te vullen"
          description="Koppel Hevy of log een workout om je trainingsdata te zien."
          action={{ label: 'Ga naar instellingen', href: '/settings' }}
        />
      </div>
    )
  }

  const weekly = data.weeklyAggregation
  const ratio = weekly?.acute_chronic_ratio ?? 0
  const status = (weekly?.workload_status ?? 'low') as WorkloadStatus
  const muscleLoad = (weekly?.weekly_muscle_load as Record<string, number>) ?? {}

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      {/* Row 1: Workload + Training Block */}
      <DashboardCard title="Workload ratio">
        <div className="flex items-center justify-center">
          <WorkloadMeter ratio={ratio} status={status} />
        </div>
        {weekly && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold tabular-nums text-text-primary">
                {weekly.total_sessions ?? 0}
              </p>
              <p className="text-xs text-text-tertiary">
                sessies
              </p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-text-primary">
                {Math.round((weekly.total_training_minutes ?? 0) / 60 * 10) / 10}u
              </p>
              <p className="text-xs text-text-tertiary">
                trainingstijd
              </p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-text-primary">
                {Math.round(weekly.total_tonnage_kg ?? 0).toLocaleString('nl-NL')}
              </p>
              <p className="text-xs text-text-tertiary">
                kg tonnage
              </p>
            </div>
          </div>
        )}
      </DashboardCard>

      <DashboardCard title="Trainingsblok">
        <TrainingBlockIndicator schema={data.activeSchema} />
      </DashboardCard>

      {/* Row 2: Adherence (full width) */}
      <DashboardCard title="Deze week" className="lg:col-span-2">
        <AdherenceTracker
          dailyAggregations={data.dailyAggregations}
          weekStart={weekStart}
        />
      </DashboardCard>

      {/* Row 3: Muscle Heatmap (full width) */}
      <DashboardCard title="Spiergroepbelasting" className="lg:col-span-2">
        <MuscleHeatmap muscleLoad={muscleLoad} />
      </DashboardCard>

      {/* Row 4: Sport Split (full width) */}
      <DashboardCard title="Sport verdeling" className="lg:col-span-2">
        <SportSplit
          gymMinutes={weekly?.total_training_minutes ?? 0}
          runningMinutes={
            data.dailyAggregations.reduce((sum, d) => sum + (d.running_minutes ?? 0), 0)
          }
          padelMinutes={
            data.dailyAggregations.reduce((sum, d) => sum + (d.padel_minutes ?? 0), 0)
          }
        />
      </DashboardCard>
    </div>
  )
}

function DumbbellIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M3 9v6M21 9v6M6.5 6.5v11M17.5 6.5v11" />
    </svg>
  )
}
