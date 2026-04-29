'use client'

import Link from 'next/link'
import { CoachOrb, type CoachOrbState } from '@/components/shared/CoachOrb'
import type { SchemaWeekDay, ExerciseData } from '@/hooks/useSchemaWeek'

interface HomeHeroProps {
  day: SchemaWeekDay | undefined
}

interface HeroContent {
  eyebrow: string
  big: string
  subtitle: string
  href: string
  orbState: CoachOrbState
}

function findHeroExercise(exercises: ExerciseData[]): ExerciseData | null {
  for (const ex of exercises) {
    const lower = ex.name.toLowerCase()
    if (lower.includes('warm') || lower.includes('cooldown')) continue
    const workingSets = ex.sets.filter((s) => s.set_type !== 'warmup')
    if (workingSets.length > 0) return ex
  }
  return null
}

function computeHero(day: SchemaWeekDay | undefined): HeroContent {
  if (!day) {
    return {
      eyebrow: 'Vandaag',
      big: '—',
      subtitle: 'Geen data',
      href: '/',
      orbState: 'idle',
    }
  }

  if (day.status === 'rest' || !day.workout) {
    return {
      eyebrow: 'Vandaag',
      big: 'Rust',
      subtitle: 'Geen workout gepland — geniet van je herstel',
      href: '/',
      orbState: 'idle',
    }
  }

  if (day.status === 'completed') {
    return {
      eyebrow: 'Vandaag · Klaar',
      big: day.workout.title,
      subtitle: day.completedWorkout?.duration_seconds
        ? `${Math.round(day.completedWorkout.duration_seconds / 60)} min · sessie afgerond`
        : 'Sessie afgerond',
      href: '/',
      orbState: 'ready',
    }
  }

  // Planned/today: show the headline working set from last performance
  const exercises = day.lastPerformance?.exercises ?? []
  const hero = findHeroExercise(exercises)

  if (hero) {
    const workingSets = hero.sets.filter((s) => s.set_type !== 'warmup')
    const setCount = workingSets.length
    const reps = workingSets[0]?.reps ?? '?'
    const weight = workingSets[0]?.weight_kg
    const big = weight ? `${setCount}×${reps} @${weight}kg` : `${setCount}×${reps}`
    return {
      eyebrow: 'Vandaag',
      big,
      subtitle: `${hero.name} · ${day.workout.title}`,
      href: '/schema',
      orbState: 'idle',
    }
  }

  return {
    eyebrow: 'Vandaag',
    big: day.workout.title,
    subtitle: day.workout.subtitle ?? 'Train op gevoel',
    href: '/schema',
    orbState: 'idle',
  }
}

export function HomeHero({ day }: HomeHeroProps) {
  const hero = computeHero(day)

  return (
    <Link
      href={hero.href}
      className="block rounded-3xl border border-bg-border bg-bg-surface p-5 transition-opacity active:opacity-70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption2 font-semibold uppercase tracking-wider text-text-tertiary">
            {hero.eyebrow}
          </p>
          <p
            className="mt-1 font-bold tracking-tight text-text-primary tabular-nums"
            style={{
              fontSize: 'clamp(44px, 12vw, 72px)',
              lineHeight: 1.02,
            }}
          >
            {hero.big}
          </p>
          <p className="mt-2 text-subhead leading-snug text-text-secondary">
            {hero.subtitle}
          </p>
        </div>
        <CoachOrb size={28} state={hero.orbState} className="mt-1" />
      </div>
    </Link>
  )
}
