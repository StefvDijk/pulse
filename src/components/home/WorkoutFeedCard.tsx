import Link from 'next/link'
import { Trophy, Clock, Flame, Heart } from 'lucide-react'
import { ExerciseImage } from '@/components/shared/ExerciseImage'
import type { WorkoutSummary } from '@/hooks/useWorkoutsFeed'
import { formatRelativeDate, formatTime } from '@/lib/formatters'

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}u ${rem}m` : `${h}u`
}

function formatVolume(kg: number | null): string | null {
  if (!kg) return null
  return `${Math.round(kg).toLocaleString('nl-NL')} kg`
}

/* ── Component ───────────────────────────────────────────── */

interface WorkoutFeedCardProps {
  workout: WorkoutSummary
}

export function WorkoutFeedCard({ workout }: WorkoutFeedCardProps) {
  const hasPRs = (workout.pr_count ?? 0) > 0
  const top3Exercises = workout.exercises.slice(0, 4)

  return (
    <Link href={`/workouts/${workout.id}`} className="block">
      <div className="rounded-2xl bg-surface-primary border border-separator p-4 transition-colors hover:border-separator active:scale-[0.99]">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-label-primary truncate">
                {workout.title}
              </h3>
              {hasPRs && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  <Trophy size={9} />
                  {workout.pr_count}
                </span>
              )}
            </div>
            <p className="text-xs text-label-tertiary mt-0.5">
              {formatRelativeDate(workout.started_at)} · {formatTime(workout.started_at)}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {workout.duration_seconds != null && (
            <span className="flex items-center gap-1 text-xs text-label-secondary">
              <Clock size={11} className="text-label-tertiary" />
              {formatDuration(workout.duration_seconds)}
            </span>
          )}
          {workout.total_volume_kg != null && (
            <span className="text-xs text-label-secondary font-medium tabular-nums">
              {formatVolume(workout.total_volume_kg)}
            </span>
          )}
          {workout.calories_burned != null && (
            <span className="flex items-center gap-1 text-xs text-label-secondary">
              <Flame size={11} className="text-orange-400" />
              {workout.calories_burned} kcal
            </span>
          )}
          {workout.avg_heart_rate != null && (
            <span className="flex items-center gap-1 text-xs text-label-secondary">
              <Heart size={11} className="text-red-400" />
              {workout.avg_heart_rate} bpm
            </span>
          )}
        </div>

        {/* Exercise list */}
        {top3Exercises.length > 0 && (
          <div className="flex flex-col divide-y divide-separator">
            {top3Exercises.map((exercise, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <ExerciseImage
                  imageUrl={exercise.image_url}
                  muscleGroup={exercise.primary_muscle_group}
                  name={exercise.name}
                  size="sm"
                />
                <div className="flex flex-1 items-center justify-between min-w-0 gap-2">
                  <span className="text-sm text-label-primary truncate">{exercise.name}</span>
                  {exercise.set_summary && (
                    <span className="text-xs tabular-nums text-label-tertiary shrink-0">
                      {exercise.set_summary}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {workout.exercises.length > 4 && (
              <p className="pt-2 text-xs text-label-tertiary">
                +{workout.exercises.length - 4} oefeningen meer
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
