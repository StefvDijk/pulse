'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Trophy, Clock, Flame, Heart, ChevronRight } from 'lucide-react'
import { useWorkoutDetail } from '@/hooks/useWorkoutDetail'
import { ExerciseImage } from '@/components/shared/ExerciseImage'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import type { WorkoutExerciseDetail, WorkoutSet } from '@/app/api/workouts/[id]/route'
import { formatFullDate, formatTime } from '@/lib/formatters'

/* ── Helpers ─────────────────────────────────────────────── */

function formatDuration(s: number): string {
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}u ${m % 60}m`
}

/* ── Set row ─────────────────────────────────────────────── */

function SetRow({
  set,
  prevSet,
  index,
}: {
  set: WorkoutSet
  prevSet?: WorkoutSet
  index: number
}) {
  const isWarmup = set.set_type === 'warmup'
  const isDropset = set.set_type === 'dropset'

  const improved =
    prevSet?.weight_kg && set.weight_kg && set.weight_kg > prevSet.weight_kg

  return (
    <div
      className={`flex items-center gap-3 py-2 ${isWarmup ? 'opacity-50' : ''}`}
    >
      {/* Set number */}
      <span className="w-5 text-xs text-label-tertiary text-right shrink-0">
        {isWarmup ? 'W' : isDropset ? 'D' : index + 1}
      </span>

      {/* Weight + reps */}
      <div className="flex flex-1 items-center gap-2">
        {set.weight_kg != null && (
          <span className="text-sm font-medium tabular-nums text-label-primary">
            {set.weight_kg} kg
          </span>
        )}
        {set.reps != null && (
          <span className="text-sm text-label-secondary">
            × {set.reps}
          </span>
        )}
        {set.distance_meters != null && set.distance_meters > 0 && (
          <span className="text-sm text-label-secondary tabular-nums">
            {(set.distance_meters / 1000).toFixed(2)} km
          </span>
        )}
        {set.duration_seconds != null && set.duration_seconds > 0 && !set.distance_meters && (
          <span className="text-sm text-label-secondary tabular-nums">
            {Math.round(set.duration_seconds)}s
          </span>
        )}
      </div>

      {/* Progress vs previous */}
      {improved && (
        <span className="text-[10px] font-semibold text-green-400 shrink-0">
          ↑ +{(set.weight_kg! - prevSet!.weight_kg!)}kg
        </span>
      )}

      {/* RPE */}
      {set.rpe != null && (
        <span className="text-xs text-label-tertiary shrink-0">
          RPE {set.rpe}
        </span>
      )}
    </div>
  )
}

/* ── Exercise card ───────────────────────────────────────── */

function ExerciseCard({
  exercise,
  prevExercise,
}: {
  exercise: WorkoutExerciseDetail
  prevExercise?: { name: string; sets: WorkoutSet[] }
}) {
  const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')
  const warmupSets = exercise.sets.filter((s) => s.set_type === 'warmup')

  return (
    <div className="rounded-2xl bg-surface-primary border border-separator p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <ExerciseImage
          imageUrl={exercise.image_url}
          muscleGroup={exercise.primary_muscle_group}
          name={exercise.name}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-label-primary truncate">
              {exercise.name}
            </span>
            {exercise.is_pr && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <Trophy size={9} /> PR
              </span>
            )}
          </div>
          <span className="text-xs text-label-tertiary">
            {workingSets.length} {workingSets.length === 1 ? 'set' : 'sets'}
            {warmupSets.length > 0 && ` + ${warmupSets.length} opwarming`}
          </span>
        </div>
      </div>

      {/* Sets */}
      <div className="divide-y divide-separator">
        {exercise.sets.map((set, i) => {
          const workingIndex = exercise.sets
            .filter((s) => s.set_type !== 'warmup')
            .indexOf(set)
          const prevSet = prevExercise?.sets[workingIndex]
          return (
            <SetRow
              key={set.set_order}
              set={set}
              prevSet={prevSet}
              index={workingIndex >= 0 ? workingIndex : i}
            />
          )
        })}
      </div>

      {/* Notes */}
      {exercise.notes && (
        <p className="mt-2 text-xs text-label-tertiary italic">{exercise.notes}</p>
      )}
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────── */

interface WorkoutDetailPageProps {
  workoutId: string
}

export function WorkoutDetailPage({ workoutId }: WorkoutDetailPageProps) {
  const router = useRouter()
  const { workout, isLoading, error } = useWorkoutDetail(workoutId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4">
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
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-system-gray6" />
              <SkeletonLine width="w-1/3" />
            </div>
            <SkeletonRect height="h-24" />
          </SkeletonCard>
        ))}
      </div>
    )
  }

  if (error || !workout) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-label-tertiary"
        >
          <ArrowLeft size={15} /> Terug
        </button>
        <p className="text-sm text-label-tertiary">Workout niet gevonden.</p>
      </div>
    )
  }

  const prevExerciseMap = new Map(
    (workout.previous?.exercises ?? []).map((e) => [e.name.toLowerCase(), e]),
  )

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1.5 text-sm text-label-tertiary hover:text-label-primary transition-colors"
      >
        <ArrowLeft size={15} /> Terug
      </button>

      {/* Workout header card */}
      <div className="rounded-2xl bg-surface-primary border border-separator p-4">
        <h1 className="text-xl font-bold text-label-primary mb-1">{workout.title}</h1>
        <p className="text-sm text-label-tertiary mb-4">
          {formatFullDate(workout.started_at)} · {formatTime(workout.started_at)}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {workout.duration_seconds != null && (
            <div className="flex items-center gap-2 rounded-xl bg-system-gray6 px-3 py-2">
              <Clock size={14} className="text-label-tertiary shrink-0" />
              <div>
                <p className="text-sm font-semibold tabular-nums text-label-primary">
                  {formatDuration(workout.duration_seconds)}
                </p>
                <p className="text-[10px] text-label-tertiary">Duur</p>
              </div>
            </div>
          )}
          {workout.total_volume_kg != null && (
            <div className="flex items-center gap-2 rounded-xl bg-system-gray6 px-3 py-2">
              <span className="text-label-tertiary text-sm shrink-0">⚡</span>
              <div>
                <p className="text-sm font-semibold tabular-nums text-label-primary">
                  {Math.round(workout.total_volume_kg).toLocaleString('nl-NL')} kg
                </p>
                <p className="text-[10px] text-label-tertiary">Volume</p>
              </div>
            </div>
          )}
          {workout.calories_burned != null && (
            <div className="flex items-center gap-2 rounded-xl bg-system-gray6 px-3 py-2">
              <Flame size={14} className="text-orange-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold tabular-nums text-label-primary">
                  {workout.calories_burned} kcal
                </p>
                <p className="text-[10px] text-label-tertiary">Calorieën</p>
              </div>
            </div>
          )}
          {workout.avg_heart_rate != null && (
            <div className="flex items-center gap-2 rounded-xl bg-system-gray6 px-3 py-2">
              <Heart size={14} className="text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold tabular-nums text-label-primary">
                  {workout.avg_heart_rate} bpm
                  {workout.max_heart_rate && (
                    <span className="text-label-tertiary font-normal text-xs"> / {workout.max_heart_rate}</span>
                  )}
                </p>
                <p className="text-[10px] text-label-tertiary">Hartslag</p>
              </div>
            </div>
          )}
        </div>

        {/* PR badge */}
        {(workout.pr_count ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <Trophy size={14} className="text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-300">
              {workout.pr_count} persoonlijk{workout.pr_count === 1 ? '' : 'e'} record{workout.pr_count === 1 ? '' : 's'} gebroken!
            </p>
          </div>
        )}

        {/* Previous session link */}
        {workout.previous && (
          <div className="mt-3 flex items-center justify-between text-xs text-label-tertiary">
            <span>
              Vorige sessie: {new Date(workout.previous.started_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </span>
            <ChevronRight size={12} />
          </div>
        )}
      </div>

      {/* Exercise cards — filter out standalone warm-up entries */}
      <div className="flex flex-col gap-3">
        {workout.exercises
          .filter((e) => !e.name.toLowerCase().includes('warm up'))
          .map((exercise) => (
            <ExerciseCard
              key={exercise.exercise_order}
              exercise={exercise}
              prevExercise={prevExerciseMap.get(exercise.name.toLowerCase())}
            />
          ))}
      </div>

      {workout.notes && (
        <div className="rounded-2xl bg-surface-primary border border-separator p-4">
          <p className="text-sm font-medium text-label-secondary mb-1">Notities</p>
          <p className="text-sm text-label-primary">{workout.notes}</p>
        </div>
      )}
    </div>
  )
}
