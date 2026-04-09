'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { getMuscleLabel } from '@/components/home/MuscleGroupDot'
import {
  getExercisesForMuscle,
  type ExerciseHit,
  type MuscleMapWorkout,
} from '@/lib/muscle-map/volume'

/* ── Props ──────────────────────────────────────────────────── */

export interface MuscleDrilldownSheetProps {
  /** DB muscle group (e.g. `chest`). `null` means the sheet is closed. */
  muscleGroup: string | null
  /** Workouts from the currently selected days in `MuscleMapCard`. */
  workouts: MuscleMapWorkout[]
  onClose: () => void
}

/* ── Helpers ────────────────────────────────────────────────── */

const AMS_TZ = 'Europe/Amsterdam'

function formatWorkoutDate(iso: string): string {
  const dt = new Date(iso)
  const dayShortRaw = dt
    .toLocaleDateString('nl-NL', { timeZone: AMS_TZ, weekday: 'short' })
    .replace('.', '')
  const dayShort = dayShortRaw.charAt(0).toUpperCase() + dayShortRaw.slice(1)
  const dayNumber = dt.toLocaleDateString('nl-NL', { timeZone: AMS_TZ, day: 'numeric' })
  return `${dayShort} ${dayNumber}`
}

interface WorkoutGroup {
  workoutId: string
  workoutTitle: string
  workoutStartedAt: string
  hits: ExerciseHit[]
}

function groupByWorkout(hits: ExerciseHit[]): WorkoutGroup[] {
  const groups: WorkoutGroup[] = []
  const indexByWorkoutId = new Map<string, number>()

  for (const hit of hits) {
    let idx = indexByWorkoutId.get(hit.workoutId)
    if (idx === undefined) {
      idx = groups.length
      indexByWorkoutId.set(hit.workoutId, idx)
      groups.push({
        workoutId: hit.workoutId,
        workoutTitle: hit.workoutTitle,
        workoutStartedAt: hit.workoutStartedAt,
        hits: [],
      })
    }
    groups[idx]!.hits.push(hit)
  }

  return groups
}

/* ── Component ──────────────────────────────────────────────── */

export function MuscleDrilldownSheet({
  muscleGroup,
  workouts,
  onClose,
}: MuscleDrilldownSheetProps) {
  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!muscleGroup) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [muscleGroup, onClose])

  if (!muscleGroup) return null

  const hits = getExercisesForMuscle(workouts, muscleGroup)
  const totalHits = hits.reduce(
    (acc, h) => acc + (h.role === 'primary' ? h.sets : h.sets * 0.5),
    0,
  )
  const groups = groupByWorkout(hits)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative flex w-full max-w-md flex-col rounded-t-3xl bg-surface-primary shadow-2xl sm:rounded-3xl max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-separator px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-headline font-semibold text-label-primary">
              {getMuscleLabel(muscleGroup)}
            </h2>
            <p className="mt-0.5 text-caption1 text-label-tertiary">
              {Math.round(totalHits)} {Math.round(totalHits) === 1 ? 'hit' : 'hits'}
              {hits.length > 0 && (
                <>
                  {' · '}
                  {hits.length} {hits.length === 1 ? 'oefening' : 'oefeningen'}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-system-gray6 text-label-tertiary hover:bg-system-gray5"
            aria-label="Sluiten"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-subhead text-label-secondary">
                Geen oefeningen voor deze spiergroep in de geselecteerde dagen.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 px-5 py-4">
              {groups.map((group) => (
                <div key={group.workoutId} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="truncate text-footnote font-semibold text-label-primary">
                      {group.workoutTitle}
                    </h3>
                    <span className="shrink-0 text-caption1 text-label-tertiary">
                      {formatWorkoutDate(group.workoutStartedAt)}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {group.hits.map((hit, idx) => (
                      <li
                        key={`${hit.workoutId}-${hit.exerciseName}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-system-gray6 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-footnote text-label-primary">
                            {hit.exerciseName}
                          </span>
                          <span
                            className={[
                              'shrink-0 rounded-full px-1.5 py-0.5 text-caption2 font-medium',
                              hit.role === 'primary'
                                ? 'bg-system-orange/15 text-system-orange'
                                : 'bg-system-gray5 text-label-secondary',
                            ].join(' ')}
                          >
                            {hit.role === 'primary' ? 'primair' : 'secundair'}
                          </span>
                        </div>
                        <span className="shrink-0 text-caption1 tabular-nums text-label-secondary">
                          {hit.sets} {hit.sets === 1 ? 'set' : 'sets'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
