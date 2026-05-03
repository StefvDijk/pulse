'use client'

import { useState, useEffect, useRef } from 'react'
import { useProgressData } from '@/hooks/useProgressData'
import { useExerciseList } from '@/hooks/useExerciseList'
import { useExerciseProgress } from '@/hooks/useExerciseProgress'
import { useBigLifts } from '@/hooks/useBigLifts'
import { ExercisePicker } from './ExercisePicker'
import { ProgressionChart } from './ProgressionChart'
import { BigLiftsTable } from './BigLiftsTable'
import { PRList } from './PRList'
import { BodyComposition } from './BodyComposition'
import { TonnageTrend } from './TonnageTrend'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'

function Card({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[22px] bg-bg-surface border-[0.5px] border-bg-border p-[18px]">
      <div className="text-[16px] font-semibold text-text-primary">{title}</div>
      {sub && <div className="mb-3 mt-1 text-[12px] text-text-tertiary">{sub}</div>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  )
}

export function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const { data: progressData, isLoading: progressLoading, error: progressError, refresh } = useProgressData('4w')
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
      <div className="flex flex-col gap-6 px-4 pb-24 pt-6">
        <SkeletonLine width="w-1/4" height="h-7" />
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
    )
  }

  if (progressError) {
    return (
      <div className="flex flex-col gap-3.5 px-4 pb-24 pt-[60px]">
        <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Progressie</h1>
        <ErrorAlert message="Kon data niet laden." onRetry={refresh} />
      </div>
    )
  }

  const hasData = (progressData?.personalRecords.length ?? 0) > 0 || exercises.length > 0

  return (
    <div className="flex flex-col gap-3.5 px-4 pb-24 pt-[60px]">
      <div className="pt-1">
        <h1 className="text-[34px] font-bold tracking-[-0.8px] text-text-primary">Progressie</h1>
        <div className="mt-1 text-[13px] text-text-tertiary">Je metrics over tijd</div>
      </div>

      {!hasData ? (
        <EmptyState
          title="Nog geen progressiedata"
          description="Start met trainen en je voortgang verschijnt hier."
        />
      ) : (
        <>
          {/* Big Lifts — auto top 5 most-trained (last 8w) with baseline → now */}
          {bigLifts.length > 0 && (
            <Card title="Top oefeningen" sub="Meest getraind · laatste 8 weken">
              <BigLiftsTable bigLifts={bigLifts} onSelect={handleBigLiftSelect} />
            </Card>
          )}

          {/* Exercise Progression */}
          <div ref={chartRef}>
            <Card title="Gewichtsprogressie">
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
                    <p className="text-sm text-text-tertiary">
                      Selecteer een oefening om je progressie te zien
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Tonnage trend (UXR-090) — 8-week weekly tonnage with block markers */}
          <Card title="Tonnage · 8 weken">
            <TonnageTrend weeks={8} />
          </Card>

          {/* Personal Records */}
          {(progressData?.personalRecords.length ?? 0) > 0 && (
            <Card title="Persoonlijke records">
              <PRList records={progressData!.personalRecords} />
            </Card>
          )}

          {/* Body Composition */}
          <Card title="Lichaamssamenstelling">
            <BodyComposition />
          </Card>
        </>
      )}
    </div>
  )
}
