'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { NavBar } from '@/components/ui/NavBar'
import { useWorkoutDetail } from '@/hooks/useWorkoutDetail'
import { Card } from '@/components/ui/v2'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { WorkoutHero } from './v2/WorkoutHero'
import { WorkoutStatsBar } from './v2/WorkoutStatsBar'
import { ExerciseCard } from './v2/ExerciseCard'
import type { WorkoutSet } from '@/app/api/workouts/[id]/route'

function formatDuration(s: number): string {
  const m = Math.round(s / 60)
  return m < 60 ? `${m}` : `${Math.floor(m / 60)}u ${m % 60}m`
}

function formatDurationUnit(s: number): string {
  return s < 3600 ? 'min' : ''
}

interface WorkoutDetailPageProps {
  workoutId: string
}

export function WorkoutDetailPage({ workoutId }: WorkoutDetailPageProps) {
  const router = useRouter()
  const { workout, isLoading, error } = useWorkoutDetail(workoutId)

  const backButton = (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-0.5 text-[#0A84FF] active:opacity-60 transition-opacity"
      aria-label="Terug"
    >
      <ChevronLeft size={20} strokeWidth={2.5} />
      <span className="text-[17px] tracking-[-0.2px]">Terug</span>
    </button>
  )

  if (isLoading) {
    return (
      <>
        <NavBar variant="inline" leading={backButton} />
        <div className="flex flex-col gap-4 px-4 pb-24 pt-4">
          <SkeletonLine width="w-1/3" height="h-5" />
          <SkeletonCard className="flex flex-col gap-2">
            <SkeletonLine width="w-1/2" />
            <div className="flex gap-3">
              <SkeletonLine width="w-12" height="h-3" />
              <SkeletonLine width="w-16" height="h-3" />
            </div>
          </SkeletonCard>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="flex flex-col gap-3">
              <SkeletonRect height="h-24" />
            </SkeletonCard>
          ))}
        </div>
      </>
    )
  }

  if (error || !workout) {
    return (
      <>
        <NavBar variant="inline" leading={backButton} />
        <div className="flex flex-col gap-4 px-4 pb-24 pt-4">
          <p className="text-[14px] text-text-tertiary">Workout niet gevonden.</p>
        </div>
      </>
    )
  }

  const prevExerciseMap = new Map(
    (workout.previous?.exercises ?? []).map((e) => [e.name.toLowerCase(), e]),
  )

  const visibleExercises = workout.exercises.filter(
    (e) => !e.name.toLowerCase().includes('warm up'),
  )

  const totalSets = visibleExercises.reduce((acc, e) => acc + e.sets.length, 0)

  // Build stats list, filtering nulls
  const stats = [
    workout.duration_seconds != null && {
      v: formatDuration(workout.duration_seconds),
      u: formatDurationUnit(workout.duration_seconds),
      l: 'Duur',
    },
    { v: totalSets, u: 'sets', l: 'Volume' },
    workout.total_volume_kg != null && {
      v: (workout.total_volume_kg / 1000).toFixed(1),
      u: 'k',
      l: 'Tonnage',
    },
    workout.avg_heart_rate != null && {
      v: workout.avg_heart_rate,
      u: 'bpm',
      l: 'Avg HR',
    },
    workout.calories_burned != null && {
      v: workout.calories_burned,
      u: 'kcal',
      l: 'Kcal',
    },
  ].filter(Boolean) as Array<{ v: string | number; u: string; l: string }>

  return (
    <>
      <NavBar variant="inline" leading={backButton} />

      <div className="flex flex-col gap-3 pb-24">
        <WorkoutHero
          title={workout.title}
          startedAt={workout.started_at}
          source={null}
          prCount={workout.pr_count}
        />

        <div className="px-4">
          <WorkoutStatsBar stats={stats} />
        </div>

        <div className="flex flex-col gap-2.5 px-4">
          {visibleExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.exercise_order}
              exercise={exercise}
              prevExercise={prevExerciseMap.get(exercise.name.toLowerCase())}
            />
          ))}
        </div>

        {workout.notes && (
          <div className="px-4">
            <Card className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-text-tertiary">
                Notities
              </div>
              <div className="mt-1.5 text-[13px] leading-snug text-text-secondary">
                {workout.notes}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
