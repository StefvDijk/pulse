'use client'

import { useState } from 'react'
import { useProgressData } from '@/hooks/useProgressData'
import { TimePeriodSelector } from '@/components/shared/TimePeriodSelector'
import { VolumeChart } from './VolumeChart'
import { StrengthChart } from './StrengthChart'
import { RunningChart } from './RunningChart'
import { PRList } from './PRList'
import { GoalProgress } from './GoalProgress'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Period } from '@/app/api/progress/route'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[17px] font-semibold text-text-primary">
      {children}
    </h2>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-card border border-border-light rounded-[14px] p-[14px_16px]">
      {children}
    </div>
  )
}

export function ProgressPage() {
  const [period, setPeriod] = useState<Period>('4w')
  const { data, isLoading, error, refresh } = useProgressData(period)

  const isEmpty = !isLoading && data
    && data.weeklyAggregations.length === 0
    && data.personalRecords.length === 0
    && data.goals.length === 0

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Progressie</h1>
        <TimePeriodSelector value={period} onChange={setPeriod} />
      </div>

      {error && <ErrorAlert message="Kon data niet laden." onRetry={refresh} />}

      {isLoading ? (
        <ProgressSkeleton />
      ) : isEmpty ? (
        <EmptyState
          title="Nog geen progressiedata beschikbaar"
          description="Start met trainen en je voortgang verschijnt hier."
        />
      ) : data ? (
        <>
          {/* Volume chart — full width */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>Trainingsvolume</SectionTitle>
              <span className="text-xs text-text-tertiary">min · ACWR lijn</span>
            </div>
            <VolumeChart weeks={data.weeklyAggregations} />
          </Card>

          {/* Strength + Running side by side on desktop */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <div className="mb-3">
                <SectionTitle>Bewegingspatronen</SectionTitle>
              </div>
              <StrengthChart weeks={data.weeklyAggregations} />
            </Card>

            <Card>
              <div className="mb-3">
                <SectionTitle>Hardlopen</SectionTitle>
              </div>
              <RunningChart weeks={data.weeklyAggregations} />
            </Card>
          </div>

          {/* Personal records */}
          <Card>
            <div className="mb-3">
              <SectionTitle>Persoonlijke records</SectionTitle>
            </div>
            <PRList records={data.personalRecords} />
          </Card>

          {/* Goal progress */}
          <Card>
            <div className="mb-3">
              <SectionTitle>Doelen</SectionTitle>
            </div>
            <GoalProgress goals={data.goals} />
          </Card>
        </>
      ) : null}
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-1/4" />
        <SkeletonRect height="h-40" />
      </SkeletonCard>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SkeletonCard className="flex flex-col gap-3">
          <SkeletonLine width="w-1/3" />
          <SkeletonRect height="h-32" />
        </SkeletonCard>
        <SkeletonCard className="flex flex-col gap-3">
          <SkeletonLine width="w-1/3" />
          <SkeletonRect height="h-32" />
        </SkeletonCard>
      </div>
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-1/4" />
        {[1,2,3].map(i => <SkeletonRect key={i} height="h-12" />)}
      </SkeletonCard>
    </div>
  )
}
