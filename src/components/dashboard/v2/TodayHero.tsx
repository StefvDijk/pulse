'use client'

import Link from 'next/link'
import { Button } from '@/components/ui'
import { SportDot, SPORT_BASE, type Sport } from '@/components/ui/v2'
import type { SchemaWeekDay } from '@/hooks/useSchemaWeek'

export interface TodayHeroProps {
  day: SchemaWeekDay | null | undefined
  sport: Sport
}

export function TodayHero({ day, sport }: TodayHeroProps) {
  if (!day || !day.workout) {
    return (
      <div className="relative overflow-hidden rounded-card-xl border-[0.5px] border-bg-border-strong bg-bg-surface p-[18px]">
        <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">
          Vandaag
        </div>
        <div className="mt-2 text-[22px] font-bold tracking-[-0.4px] text-text-primary">
          Rustdag
        </div>
        <div className="mt-1 text-[13px] text-text-secondary">
          Geen workout gepland — wandelen mag wél.
        </div>
      </div>
    )
  }

  const accent = SPORT_BASE[sport]

  // Per-sport gradient tint: gym uses teal/indigo, run uses run-orange, padel uses padel-gold
  const gradientMap: Record<Sport, string> = {
    gym: 'radial-gradient(80% 100% at 100% 0%, rgba(0,229,199,0.32), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(124,58,237,0.25), transparent 60%)',
    run: 'radial-gradient(80% 100% at 100% 0%, rgba(255,94,58,0.30), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(255,45,135,0.20), transparent 60%)',
    padel: 'radial-gradient(80% 100% at 100% 0%, rgba(255,176,32,0.28), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(255,94,58,0.18), transparent 60%)',
    cycle: 'radial-gradient(80% 100% at 100% 0%, rgba(156,255,79,0.25), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(0,229,199,0.18), transparent 60%)',
  }

  return (
    <div className="relative overflow-hidden rounded-card-xl border-[0.5px] border-bg-border-strong bg-bg-surface">
      {/* Sport-tinted gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: gradientMap[sport] }}
        aria-hidden="true"
      />

      <div className="relative p-[18px]">
        {/* Sport label row */}
        <div className="flex items-center gap-2">
          <SportDot sport={sport} size={8} glow />
          <span
            className="text-[11px] font-semibold uppercase tracking-[1.2px]"
            style={{ color: accent }}
          >
            Vandaag · {day.workout.type ?? 'Training'}
          </span>
        </div>

        {/* Workout title */}
        <div className="mt-2 text-[22px] font-bold tracking-[-0.4px] text-text-primary">
          {day.workout.title}
        </div>

        {/* Subtitle / duration */}
        <div className="mt-1 text-[13px] text-text-secondary">
          {day.workout.subtitle || `≈ ${day.workout.duration_min} min`}
        </div>

        {/* CTA row */}
        <div className="mt-4 flex gap-2">
          <Link href="/schema" className="flex-1">
            <Button variant="filled" size="lg" fullWidth>
              Start workout →
            </Button>
          </Link>
          <Link
            href="/schema"
            aria-label="Schema detail"
            className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-card-md border-[0.5px] border-white/[0.14] bg-white/[0.06] text-[18px] text-white active:opacity-60"
          >
            ›
          </Link>
        </div>
      </div>
    </div>
  )
}
