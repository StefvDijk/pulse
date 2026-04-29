'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CoachOrb, type CoachOrbState } from '@/components/shared/CoachOrb'
import { useTodaysMove } from '@/hooks/useTodaysMove'
import type { TodayMoveType } from '@/app/api/today/route'

interface TypeStyle {
  eyebrow: string
  orbState: CoachOrbState
  bgGradient: string
}

const TYPE_STYLE: Record<TodayMoveType, TypeStyle> = {
  training: {
    eyebrow: "Vandaag's move",
    orbState: 'idle',
    bgGradient: 'linear-gradient(135deg, rgba(0,229,199,0.10), rgba(124,58,237,0.06))',
  },
  rest: {
    eyebrow: 'Vandaag',
    orbState: 'ready',
    bgGradient: 'linear-gradient(135deg, rgba(34,214,122,0.08), rgba(0,229,199,0.05))',
  },
  check_in: {
    eyebrow: 'Tijd voor',
    orbState: 'warning',
    bgGradient: 'linear-gradient(135deg, rgba(255,176,32,0.10), rgba(255,94,58,0.06))',
  },
}

export function TodaysMove() {
  const { data, isLoading } = useTodaysMove()

  if (isLoading || !data) {
    return (
      <div
        className="rounded-3xl border border-bg-border bg-bg-surface p-6"
        aria-hidden="true"
      >
        <div className="flex flex-col gap-3">
          <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
          <div className="h-8 w-3/4 rounded-full bg-white/[0.06]" />
          <div className="h-4 w-2/3 rounded-full bg-white/[0.06]" />
          <div className="mt-2 h-9 w-32 rounded-full bg-white/[0.06]" />
        </div>
      </div>
    )
  }

  const style = TYPE_STYLE[data.type]

  return (
    <Link
      href={data.actionHref}
      className="block rounded-3xl border border-bg-border bg-bg-surface p-6 transition-opacity active:opacity-80"
      style={{ background: style.bgGradient }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-caption2 font-semibold uppercase tracking-wider text-text-tertiary">
            {style.eyebrow}
          </p>
          <h2 className="mt-1.5 text-title1 font-bold leading-tight tracking-tight text-text-primary">
            {data.title}
          </h2>
          <p className="mt-2 text-subhead leading-snug text-text-secondary">
            {data.subtitle}
          </p>
        </div>
        <CoachOrb size={32} state={style.orbState} className="mt-1" />
      </div>

      <div className="mt-5 flex items-center gap-1.5 text-[#0A84FF]">
        <span className="text-subhead font-semibold">{data.actionLabel}</span>
        <ChevronRight size={18} strokeWidth={2.5} />
      </div>
    </Link>
  )
}
