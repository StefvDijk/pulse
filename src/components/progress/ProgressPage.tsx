'use client'

import { useState, useEffect, useRef } from 'react'
import { useProgressData } from '@/hooks/useProgressData'
import { useExerciseList } from '@/hooks/useExerciseList'
import { useExerciseProgress } from '@/hooks/useExerciseProgress'
import { useBigLifts } from '@/hooks/useBigLifts'
import { ExercisePicker } from './ExercisePicker'
import { ProgressionChart } from './ProgressionChart'
import { BigLiftsTable } from './BigLiftsTable'
import { BodyComposition } from './BodyComposition'
import { TonnageTrend } from './TonnageTrend'
import { ProgressHeader, ProgressSectionCard, PRCard } from './v2'
import type { ProgressPeriod } from './v2'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'

export function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [period, setPeriod] = useState<ProgressPeriod>('4w')
  const chartRef = useRef<HTMLDivElement>(null)
  const { data: progressData, isLoading: progressLoading, error: progressError, refresh } = useProgressData(period)
  const { exercises, isLoading: exercisesLoading } = useExerciseList()
  const { bigLifts } = useBigLifts()
  const { data: exerciseProgress, isLoading: chartLoading } = useExerciseProgress(selectedExercise)

  const handleBigLiftSelect = (name: string) => {
    setSelectedExercise(name)
    requestAnimationFrame(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Auto-select first exercise when list loads
  useEffect(() => {
    if (!selectedExercise && exercises.length > 0) {
      setSelectedExercise(exercises[0].name)
    }
  }, [exercises, selectedExercise])

  const isLoading = progressLoading || exercisesLoading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 pb-24">
        <div className="px-4 pt-[64px] pb-3">
          <div className="h-8 w-1/3 rounded-xl bg-white/[0.06]" />
          <div className="mt-3.5 h-10 rounded-[12px] bg-white/[0.06]" />
        </div>
        <div className="px-4 flex flex-col gap-3">
          <SkeletonCard className="flex flex-col gap-3">
            <SkeletonLine width="w-1/3" />
            <SkeletonRect height="h-10" />
            <SkeletonRect height="h-40" />
          </SkeletonCard>
          <SkeletonCard className="flex flex-col gap-3">
            <SkeletonLine width="w-1/4" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonRect key={i} height="h-20" />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    )
  }

  if (progressError) {
    return (
      <div className="flex flex-col gap-3 pb-24">
        <ProgressHeader selectedPeriod={period} onPeriodChange={setPeriod} />
        <div className="px-4">
          <ErrorAlert message="Kon data niet laden." onRetry={refresh} />
        </div>
      </div>
    )
  }

  const hasData = (progressData?.personalRecords.length ?? 0) > 0 || exercises.length > 0
  const prCount = progressData?.personalRecords.length ?? 0

  return (
    <div className="flex flex-col pb-24">
      {/* v2 page header with period selector */}
      <ProgressHeader selectedPeriod={period} onPeriodChange={setPeriod} />

      <div className="flex flex-col gap-3 px-4">
        {!hasData ? (
          <EmptyState
            title="Nog geen progressiedata"
            description="Start met trainen en je voortgang verschijnt hier."
          />
        ) : (
          <>
            {/* Big Lifts — auto top 5 most-trained (last 8w) with baseline → now */}
            {bigLifts.length > 0 && (
              <ProgressSectionCard
                eyebrow="Meest getraind · laatste 8 weken"
                title="Top oefeningen"
              >
                <BigLiftsTable bigLifts={bigLifts} onSelect={handleBigLiftSelect} />
              </ProgressSectionCard>
            )}

            {/* Exercise Progression */}
            <div ref={chartRef}>
              <ProgressSectionCard title="Gewichtsprogressie">
                <div className="flex flex-col gap-4">
                  <ExercisePicker
                    exercises={exercises}
                    selected={selectedExercise}
                    onSelect={setSelectedExercise}
                  />
                  {chartLoading ? (
                    <div className="flex h-40 items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-bg-border border-t-text-primary" />
                    </div>
                  ) : exerciseProgress ? (
                    <ProgressionChart data={exerciseProgress} />
                  ) : (
                    <div className="flex h-40 items-center justify-center">
                      <p className="text-[13px] text-text-tertiary">
                        Selecteer een oefening om je progressie te zien
                      </p>
                    </div>
                  )}
                </div>
              </ProgressSectionCard>
            </div>

            {/* Tonnage trend — 8-week weekly tonnage with block markers */}
            <ProgressSectionCard
              eyebrow="Wekelijks volume · 8 weken"
              title="Tonnage"
            >
              <TonnageTrend weeks={8} />
            </ProgressSectionCard>

            {/* Personal Records */}
            {prCount > 0 && (
              <PRCard records={progressData!.personalRecords} prCount={prCount} />
            )}

            {/* Body Composition */}
            <ProgressSectionCard title="Lichaamssamenstelling">
              <BodyComposition />
            </ProgressSectionCard>
          </>
        )}
      </div>
    </div>
  )
}
