'use client'

import Link from 'next/link'
import { Trophy, Clock, Flame, Heart } from 'lucide-react'
import { MiniMuscleHeatmap } from '@/components/dashboard/MiniMuscleHeatmap'
import type { WorkoutSummary } from '@/hooks/useWorkoutsFeed'

/* ── Helpers ─────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}u ${rem}m` : `${h}u`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)

  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  if (diffDays < 7) {
    const days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
    return days[d.getDay()]
  }
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function formatVolume(kg: number | null): string | null {
  if (!kg) return null
  return `${Math.round(kg).toLocaleString('nl-NL')} kg`
}

function hasMuscleVolume(volume: Record<string, number>): boolean {
  for (const v of Object.values(volume)) {
    if (v > 0) return true
  }
  return false
}

/* ── Component ───────────────────────────────────────────── */

interface WorkoutFeedCardProps {
  workout: WorkoutSummary
}

export function WorkoutFeedCard({ workout }: WorkoutFeedCardProps) {
  const hasPRs = (workout.pr_count ?? 0) > 0
  const showHeatmap = hasMuscleVolume(workout.muscle_volume ?? {})

  return (
    <Link href={`/workouts/${workout.id}`} className="block">
      <div className="rounded-2xl bg-surface-primary border border-separator p-4 transition-colors hover:border-separator active:scale-[0.99]">
        {/* Hero row — heatmap on the left, headline on the right */}
        <div className="flex items-start gap-4">
          {showHeatmap && (
            <div className="shrink-0">
              <MiniMuscleHeatmap volume={workout.muscle_volume} height={108} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
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
                  {formatDate(workout.started_at)} · {formatTime(workout.started_at)}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
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

            {/* Compact exercise count */}
            {workout.exercises.length > 0 && (
              <p className="mt-2 text-xs text-label-tertiary truncate">
                {workout.exercises.length} oefening{workout.exercises.length === 1 ? '' : 'en'}
                {' · '}
                {workout.exercises.slice(0, 2).map((e) => e.name).join(', ')}
                {workout.exercises.length > 2 ? ` +${workout.exercises.length - 2}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
