'use client'

import { useMemo, useState } from 'react'
import { Footprints, Timer } from 'lucide-react'
import { Card } from '@/components/ui'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { getMuscleLabel } from '@/components/home/MuscleGroupDot'
import { useMuscleMap, type MuscleMapDay } from '@/hooks/useMuscleMap'
import { computeVolume } from '@/lib/muscle-map/volume'
import { MuscleHeatmap } from './MuscleHeatmap'
import { MuscleDrilldownSheet } from './MuscleDrilldownSheet'
import type {
  MuscleMapPadelSession,
  MuscleMapRun,
} from '@/app/api/muscle-map/route'

/* ── Helpers ────────────────────────────────────────────────── */

const AMS_TZ = 'Europe/Amsterdam'

function defaultSelection(days: MuscleMapDay[]): Set<string> {
  return new Set(days.filter((d) => d.workouts.length > 0).map((d) => d.date))
}

function formatDayShort(iso: string): string {
  const dt = new Date(iso)
  const raw = dt
    .toLocaleDateString('nl-NL', { timeZone: AMS_TZ, weekday: 'short' })
    .replace('.', '')
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`
  return String(n)
}

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`
}

function formatDistanceKm(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

interface ActivityEntry {
  key: string
  icon: 'run' | 'padel'
  title: string
  dayLabel: string
  details: string
  startedAt: string
}

function buildActivityEntries(
  runs: MuscleMapRun[],
  padel: MuscleMapPadelSession[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...runs.map<ActivityEntry>((r) => ({
      key: `run-${r.id}`,
      icon: 'run',
      title: 'Hardlopen',
      dayLabel: formatDayShort(r.started_at),
      details: [formatDistanceKm(r.distance_meters), formatMinutes(r.duration_seconds)].join(' · '),
      startedAt: r.started_at,
    })),
    ...padel.map<ActivityEntry>((p) => ({
      key: `padel-${p.id}`,
      icon: 'padel',
      title: 'Padel',
      dayLabel: formatDayShort(p.started_at),
      details: formatMinutes(p.duration_seconds),
      startedAt: p.started_at,
    })),
  ]

  return entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/* ── Component ──────────────────────────────────────────────── */

export function MuscleMapCard() {
  const {
    days,
    weekRuns,
    weekPadel,
    weekSteps,
    isLoading,
    error,
    refresh,
  } = useMuscleMap()

  /**
   * `null` means "use default selection from data" (all days with workouts).
   * Once the user toggles any day we materialize the selection into a Set,
   * preventing data-refreshes from clobbering their choice.
   */
  const [override, setOverride] = useState<Set<string> | null>(null)
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)

  const selection = override ?? defaultSelection(days)

  const selectedWorkouts = useMemo(
    () => days.filter((d) => selection.has(d.date)).flatMap((d) => d.workouts),
    [days, selection],
  )

  const volume = useMemo(() => computeVolume(selectedWorkouts), [selectedWorkouts])

  const sortedMuscles = useMemo(() => {
    return Object.entries(volume)
      .filter(([, hits]) => hits > 0)
      .map(([muscle, hits]) => ({
        muscle,
        label: getMuscleLabel(muscle),
        hits,
      }))
      .sort((a, b) => b.hits - a.hits)
  }, [volume])

  const maxHits = sortedMuscles[0]?.hits ?? 0

  const sessionTags = useMemo(() => {
    const tags: Array<{ key: string; dayLabel: string; title: string }> = []
    for (const day of days) {
      if (!selection.has(day.date)) continue
      for (const workout of day.workouts) {
        tags.push({
          key: workout.id,
          dayLabel: day.dayLabelShort,
          title: workout.title,
        })
      }
    }
    return tags
  }, [days, selection])

  function toggleDay(date: string, hasWorkout: boolean) {
    if (!hasWorkout) return
    setOverride((prev) => {
      const base = new Set(prev ?? defaultSelection(days))
      if (base.has(date)) base.delete(date)
      else base.add(date)
      return base
    })
  }

  function handleMuscleClick(muscleGroup: string) {
    if ((volume[muscleGroup] ?? 0) <= 0) return
    setSelectedMuscle(muscleGroup)
  }

  const activityEntries = useMemo(
    () => buildActivityEntries(weekRuns, weekPadel),
    [weekRuns, weekPadel],
  )

  /* ── Loading / error states ── */

  if (isLoading) {
    return (
      <Card padding="md" className="flex flex-col gap-3">
        <SkeletonLine width="w-1/3" />
        <SkeletonRect height="h-48" />
      </Card>
    )
  }

  if (error) {
    return (
      <Card padding="md">
        <ErrorAlert message="Kan spierkaart niet laden." onRetry={refresh} />
      </Card>
    )
  }

  const hasAnyWorkouts = days.some((d) => d.workouts.length > 0)
  const hasAnyActivity = hasAnyWorkouts || activityEntries.length > 0

  return (
    <Card padding="md" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-headline font-semibold text-label-primary">Spierkaart</h2>
        <div className="flex items-center gap-2">
          {weekSteps > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-system-gray6 px-2 py-0.5 text-caption2 font-medium text-label-secondary">
              <Footprints size={12} className="text-label-tertiary" aria-hidden />
              {formatSteps(weekSteps)}
            </span>
          )}
          <span className="text-caption1 text-label-tertiary">Deze week</span>
        </div>
      </div>

      {/* Day selector */}
      <div className="flex justify-between gap-1">
        {days.map((day) => {
          const hasWorkout = day.workouts.length > 0
          const isOn = selection.has(day.date)
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => toggleDay(day.date, hasWorkout)}
              disabled={!hasWorkout}
              className={[
                'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors',
                isOn
                  ? 'border-system-orange bg-system-orange/10 text-system-orange'
                  : hasWorkout
                    ? 'border-separator text-label-secondary hover:bg-system-gray6'
                    : 'border-separator/60 text-label-tertiary opacity-40',
              ].join(' ')}
              aria-pressed={isOn}
              aria-label={`${day.dayLabelShort} ${day.dayNumber}${hasWorkout ? '' : ' (geen training)'}`}
            >
              <span className="text-caption2 font-medium">{day.dayLabelShort}</span>
              <span className="text-footnote font-semibold tabular-nums">{day.dayNumber}</span>
              {hasWorkout && (
                <span
                  className={[
                    'h-1 w-1 rounded-full',
                    isOn ? 'bg-system-orange' : 'bg-label-tertiary',
                  ].join(' ')}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Empty state ─ no lifting AND no other activity */}
      {!hasAnyActivity && (
        <div className="py-6 text-center">
          <p className="text-subhead text-label-secondary">
            Geen activiteit deze week.
          </p>
          <p className="mt-1 text-caption1 text-label-tertiary">
            Sync je Hevy of Apple Health data.
          </p>
        </div>
      )}

      {hasAnyWorkouts && (
        <>
          {/* Body heatmap */}
          <MuscleHeatmap volume={volume} onMuscleClick={handleMuscleClick} />

          {/* Volume bar chart */}
          {sortedMuscles.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-caption1 font-semibold uppercase tracking-[0.1em] text-label-tertiary">
                Volume per spiergroep
              </h3>
              <div className="flex flex-col gap-1.5">
                {sortedMuscles.map(({ muscle, label, hits }) => (
                  <button
                    key={muscle}
                    type="button"
                    onClick={() => handleMuscleClick(muscle)}
                    className="flex items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-system-gray6"
                  >
                    <span className="w-24 shrink-0 text-footnote text-label-secondary">
                      {label}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-system-gray6">
                      <span
                        className="block h-full rounded-full bg-system-orange transition-[width] duration-300"
                        style={{ width: `${maxHits > 0 ? (hits / maxHits) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right text-footnote font-semibold tabular-nums text-label-primary">
                      {Math.round(hits)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-caption1 text-label-tertiary">
              Selecteer een dag om spieractiviteit te zien.
            </p>
          )}

          {/* Session tags */}
          {sessionTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sessionTags.map((tag) => (
                <span
                  key={tag.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-system-gray6 px-2.5 py-1 text-caption1 text-label-secondary"
                >
                  <span className="font-semibold text-system-orange">{tag.dayLabel}</span>
                  {tag.title}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Activities — runs and padel from Apple Health (independent of day toggle) */}
      {activityEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-caption1 font-semibold uppercase tracking-[0.1em] text-label-tertiary">
            Overige activiteit
          </h3>
          <ul className="flex flex-col gap-1.5">
            {activityEntries.map((entry) => {
              const Icon = entry.icon === 'run' ? Footprints : Timer
              return (
                <li
                  key={entry.key}
                  className="flex items-center gap-3 rounded-xl bg-system-gray6 px-3 py-2"
                >
                  <Icon size={16} className="shrink-0 text-label-tertiary" aria-hidden />
                  <div className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="text-footnote font-medium text-label-primary">
                      {entry.title}
                    </span>
                    <span className="text-caption2 text-label-tertiary">{entry.dayLabel}</span>
                  </div>
                  <span className="shrink-0 text-caption1 tabular-nums text-label-secondary">
                    {entry.details}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Drill-down sheet — opens on muscle click */}
      <MuscleDrilldownSheet
        muscleGroup={selectedMuscle}
        workouts={selectedWorkouts}
        onClose={() => setSelectedMuscle(null)}
      />
    </Card>
  )
}
