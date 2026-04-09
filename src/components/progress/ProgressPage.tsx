'use client'

import { useState, useEffect } from 'react'
import { useProgressData } from '@/hooks/useProgressData'
import { useExerciseList } from '@/hooks/useExerciseList'
import { useExerciseProgress } from '@/hooks/useExerciseProgress'
import { ExercisePicker } from './ExercisePicker'
import { ProgressionChart } from './ProgressionChart'
import { PRList } from './PRList'
import { BodyComposition } from './BodyComposition'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-surface-primary border border-separator p-4">
      <h2 className="mb-3 text-base font-semibold text-label-primary">{title}</h2>
      {children}
    </div>
  )
}

export function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const { data: progressData, isLoading: progressLoading, error: progressError, refresh } = useProgressData('4w')
  const { exercises, isLoading: exercisesLoading } = useExerciseList()
  const { data: exerciseProgress, isLoading: chartLoading } = useExerciseProgress(selectedExercise)

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
      <div className="flex flex-col gap-6 px-4 pb-24 pt-6">
        <h1 className="text-title1 font-bold tracking-tight text-label-primary">Progressie</h1>
        <ErrorAlert message="Kon data niet laden." onRetry={refresh} />
      </div>
    )
  }

  const hasData = (progressData?.personalRecords.length ?? 0) > 0 || exercises.length > 0

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 pt-6">
      <h1 className="text-title1 font-bold tracking-tight text-label-primary">Progressie</h1>

      {!hasData ? (
        <EmptyState
          title="Nog geen progressiedata"
          description="Start met trainen en je voortgang verschijnt hier."
        />
      ) : (
        <>
          {/* Exercise Progression */}
          <Card title="Gewichtsprogressie">
            <div className="flex flex-col gap-4">
              <ExercisePicker
                exercises={exercises}
                selected={selectedExercise}
                onSelect={setSelectedExercise}
              />
              {chartLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-separator border-t-text-primary" />
                </div>
              ) : exerciseProgress ? (
                <ProgressionChart data={exerciseProgress} />
              ) : (
                <div className="flex h-40 items-center justify-center">
                  <p className="text-sm text-label-tertiary">
                    Selecteer een oefening om je progressie te zien
                  </p>
                </div>
              )}
            </div>
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
