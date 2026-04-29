'use client'

import { Dumbbell, CheckCircle2, Moon, TrendingUp } from 'lucide-react'
import type { SchemaWeekDay, ExerciseData } from '@/hooks/useSchemaWeek'
import { Card } from '@/components/ui'

interface TodayWorkoutCardProps {
  day: SchemaWeekDay | undefined
  tomorrowWorkout?: string | null
}

function formatSets(exercises: ExerciseData[]): ExerciseData[] {
  return exercises.filter((e) => {
    const name = e.name.toLowerCase()
    return !name.includes('warm up') && !name.includes('cooldown')
  })
}

function getMaxWeight(exercises: ExerciseData[]): Map<string, number> {
  const maxWeights = new Map<string, number>()
  for (const exercise of exercises) {
    const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')
    for (const set of workingSets) {
      if (set.weight_kg != null && set.weight_kg > 0) {
        const current = maxWeights.get(exercise.name) ?? 0
        if (set.weight_kg > current) {
          maxWeights.set(exercise.name, set.weight_kg)
        }
      }
    }
  }
  return maxWeights
}

function findAchievement(
  completedExercises: ExerciseData[],
  lastExercises: ExerciseData[],
): string {
  const completedWeights = getMaxWeight(completedExercises)
  const lastWeights = getMaxWeight(lastExercises)

  let bestIncrease = 0
  let bestExercise = ''

  for (const [name, weight] of completedWeights) {
    const previous = lastWeights.get(name)
    if (previous != null && weight > previous) {
      const increase = weight - previous
      if (increase > bestIncrease) {
        bestIncrease = increase
        bestExercise = name
      }
    }
  }

  if (bestIncrease > 0) {
    return `+${bestIncrease}kg op ${bestExercise}`
  }
  return 'Alle sets afgerond'
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return `${minutes} min`
}

function SetSummary({ exercise }: { exercise: ExerciseData }) {
  const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')
  if (workingSets.length === 0) return null

  const firstSet = workingSets[0]
  const weight = firstSet.weight_kg
  const reps = firstSet.reps

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-subhead text-text-primary">{exercise.name}</span>
      <span className="text-subhead tabular-nums text-text-secondary">
        {workingSets.length}×{reps ?? '?'}
        {weight ? ` · ${weight}kg` : ''}
      </span>
    </div>
  )
}

export function TodayWorkoutCard({ day, tomorrowWorkout }: TodayWorkoutCardProps) {
  if (!day) return null

  // Rest day
  if (day.status === 'rest' || !day.workout) {
    return (
      <Card padding="lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-system-gray6">
            <Moon size={20} strokeWidth={1.5} className="text-text-tertiary" />
          </div>
          <div>
            <p className="text-headline text-text-primary">Rustdag</p>
            <p className="text-subhead text-text-secondary">
              {tomorrowWorkout
                ? `Morgen: ${tomorrowWorkout}`
                : 'Geniet van je herstel'}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const isCompleted = day.status === 'completed'
  const exercises = isCompleted
    ? formatSets(day.completedWorkout?.exercises ?? [])
    : formatSets(day.lastPerformance?.exercises ?? [])

  return (
    <Card padding="lg">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isCompleted ? 'bg-system-green/10' : 'bg-system-blue/10'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 size={20} strokeWidth={1.5} className="text-system-green" />
            ) : (
              <Dumbbell size={20} strokeWidth={1.5} className="text-system-blue" />
            )}
          </div>
          <div>
            <p className="text-headline text-text-primary">
              {day.workout.title}
            </p>
            <p className="text-subhead text-text-secondary">
              {day.workout.subtitle}
              {day.workout.duration_min ? ` · ~${day.workout.duration_min} min` : ''}
            </p>
          </div>
        </div>
        {isCompleted && (
          <span className="rounded-full bg-system-green/10 px-2.5 py-1 text-caption1 font-semibold text-system-green">
            Gedaan
          </span>
        )}
      </div>

      {/* Achievement highlight for completed workouts */}
      {isCompleted && (
        <div className="mt-3 flex items-center gap-1.5">
          <TrendingUp size={14} strokeWidth={1.5} className="text-system-blue" />
          <span className="text-subhead font-medium text-system-blue">
            {findAchievement(
              day.completedWorkout?.exercises ?? [],
              day.lastPerformance?.exercises ?? [],
            )}
          </span>
        </div>
      )}

      {/* Compact summary for completed workouts */}
      {isCompleted && (
        <p className="mt-1.5 text-caption1 text-text-tertiary">
          {day.completedWorkout?.duration_seconds != null
            ? `${formatDuration(day.completedWorkout.duration_seconds)} · `
            : ''}
          {exercises.length} oefeningen
        </p>
      )}

      {/* Exercise list */}
      {exercises.length > 0 && (
        <div className="mt-4 divide-y divide-separator">
          {exercises.map((exercise) => (
            <SetSummary key={exercise.exercise_order} exercise={exercise} />
          ))}
        </div>
      )}

      {/* Reference note for planned workouts */}
      {!isCompleted && day.lastPerformance && (
        <p className="mt-3 text-caption1 text-text-tertiary">
          Op basis van je sessie van {day.lastPerformance.date}
        </p>
      )}
    </Card>
  )
}
