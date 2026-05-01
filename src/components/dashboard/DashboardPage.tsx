'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { useSchemaWeek, type SchemaWeekDay } from '@/hooks/useSchemaWeek'
import { useReadiness } from '@/hooks/useReadiness'
import { useReadinessSummary } from '@/hooks/useReadinessSummary'
import { useWorkload } from '@/hooks/useWorkload'
import { ReadinessDrilldownSheet } from '@/components/home/ReadinessDrilldownSheet'
import { Card, ReadinessOrb, MicroStat, ZoneBar, SportDot, SPORT_BASE, type Sport } from '@/components/ui/v2'
import { ExplainTrigger } from '@/components/explain/ExplainTrigger'
import { CheckInBadge } from '@/components/home/CheckInBadge'
import { DailyHealthBar } from '@/components/home/DailyHealthBar'
import { BodyCompositionCard } from '@/components/home/BodyCompositionCard'
import { SyncButton } from '@/components/home/SyncButton'
import { MuscleMapCard } from '@/components/dashboard/MuscleMapCard'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { listContainer, listItem, springContent } from '@/lib/motion-presets'
import Link from 'next/link'

const DATE_FMT = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Amsterdam',
})

function formatDate(d = new Date()): string {
  return DATE_FMT.format(d).replace(/^\w/, (c) => c.toUpperCase())
}

function weekNumber(d = new Date()): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000))
}

function sportFor(type: string | null | undefined): Sport {
  const t = (type ?? '').toLowerCase()
  if (t.includes('run') || t.includes('hardlop')) return 'run'
  if (t.includes('padel')) return 'padel'
  if (t.includes('cycle') || t.includes('fiets')) return 'cycle'
  return 'gym'
}

function readinessScore(level: string | undefined): number {
  if (level === 'good') return 86
  if (level === 'normal') return 68
  if (level === 'fatigued') return 48
  return 38
}

function readinessLabel(level: string | undefined): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (level === 'good') return { label: 'Goed hersteld', tone: 'good' }
  if (level === 'normal') return { label: 'Op koers', tone: 'good' }
  if (level === 'fatigued') return { label: 'Vermoeid', tone: 'warn' }
  return { label: 'Rustdag aanbevolen', tone: 'bad' }
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 pt-16">
      <SkeletonCard className="flex flex-col gap-3"><SkeletonLine width="w-2/5" /><SkeletonRect height="h-24" /></SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3"><SkeletonRect height="h-32" /></SkeletonCard>
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCard><SkeletonLine width="w-2/3" /></SkeletonCard>
        <SkeletonCard><SkeletonLine width="w-2/3" /></SkeletonCard>
      </div>
    </div>
  )
}

interface TodayWorkoutHeroProps {
  day: SchemaWeekDay | null | undefined
}

function TodayWorkoutHero({ day }: TodayWorkoutHeroProps) {
  if (!day || !day.workout) {
    return (
      <Card radius="xl" className="p-[18px]">
        <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">Vandaag</div>
        <div className="mt-2 text-[20px] font-bold tracking-[-0.4px] text-text-primary">Rustdag</div>
        <div className="mt-1 text-[13px] text-text-secondary">Geen workout gepland — wandelen mag wél.</div>
      </Card>
    )
  }
  const sport = sportFor(day.workout.type)
  const accent = SPORT_BASE[sport]
  return (
    <div
      className="relative overflow-hidden rounded-[28px] border-[0.5px] border-bg-border-strong bg-bg-surface"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 100% at 100% 0%, rgba(0,229,199,0.32), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(124,58,237,0.25), transparent 60%)',
        }}
      />
      <div className="relative p-[18px]">
        <div className="flex items-center gap-2">
          <SportDot sport={sport} size={8} glow />
          <span
            className="text-[11px] font-semibold uppercase tracking-[1.2px]"
            style={{ color: accent }}
          >
            Vandaag · {day.workout.type ?? 'Training'}
          </span>
        </div>
        <div className="mt-2 text-[24px] font-bold tracking-[-0.6px] text-text-primary">{day.workout.title}</div>
        <div className="mt-1 text-[13px] text-text-secondary">
          {day.workout.subtitle || `≈ ${day.workout.duration_min} min`}
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            href="/schema"
            className="flex h-12 flex-1 items-center justify-center rounded-[14px] bg-white text-[15px] font-semibold text-black active:opacity-80"
          >
            Start workout
          </Link>
          <Link
            href="/schema"
            aria-label="Detail"
            className="flex h-12 w-12 items-center justify-center rounded-[14px] border-[0.5px] border-white/[0.14] bg-white/[0.06] text-[18px] text-white active:opacity-60"
          >
            ›
          </Link>
        </div>
      </div>
    </div>
  )
}

interface WeekStripProps {
  days: SchemaWeekDay[]
}

function WeekStrip({ days }: WeekStripProps) {
  const completed = days.filter((d) => d.status === 'completed').length
  const planned = days.filter((d) => d.workout).length
  return (
    <Card className="p-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">Deze week</div>
        <div className="text-[11px] text-text-secondary">{completed} / {planned} voltooid</div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const sport = d.workout ? sportFor(d.workout.type) : null
          const color = sport ? SPORT_BASE[sport] : 'rgba(255,255,255,0.10)'
          const isToday = d.status === 'today'
          const done = d.status === 'completed'
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  background: done ? color : 'transparent',
                  border: done ? 'none' : `1.5px ${sport ? 'solid' : 'dashed'} ${sport ? color : 'rgba(255,255,255,0.16)'}`,
                  boxShadow: isToday ? `0 0 0 2px var(--color-bg-page), 0 0 0 3px ${sport ? color : '#fff'}` : undefined,
                }}
              >
                {done && (
                  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7l3 3 5-6" stroke="#000" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </div>
              <div className={`text-[11px] ${isToday ? 'font-semibold text-text-primary' : 'font-medium text-text-tertiary'}`}>
                {d.dayLabel.charAt(0).toUpperCase()}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const {
    data: schemaWeek,
    today,
    error: schemaError,
    isLoading: schemaLoading,
    refresh: refreshSchema,
  } = useSchemaWeek()
  const { data: readiness } = useReadiness()
  const { data: summary } = useReadinessSummary()
  const { data: workload } = useWorkload()
  const [drilldownOpen, setDrilldownOpen] = useState(false)

  if (schemaLoading) return <HomeSkeleton />
  if (schemaError) {
    return (
      <div className="p-4">
        <ErrorAlert message="Kan homepage niet laden." onRetry={refreshSchema} />
      </div>
    )
  }

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  const todayDay = today ?? schemaWeek?.days?.find((d) => d.date === todayStr) ?? null

  const score = readinessScore(readiness?.level)
  const { label: readinessLbl, tone } = readinessLabel(readiness?.level)
  const ratio = workload?.ratio ?? readiness?.acwr ?? null
  const ratioPct = ratio !== null ? Math.max(0, Math.min(1, ratio / 2.0)) : 0.5

  const sleepHours = readiness?.sleepMinutes ? Math.floor(readiness.sleepMinutes / 60) : null
  const sleepMins = readiness?.sleepMinutes ? readiness.sleepMinutes % 60 : null

  return (
    <motion.div
      className="flex flex-col gap-3 px-4 pt-16 pb-4"
      variants={listContainer}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <motion.div variants={listItem} transition={springContent} className="flex items-end justify-between pb-1">
        <div>
          <div className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">Vandaag</div>
          <div className="mt-0.5 text-[13px] text-text-secondary">
            {formatDate()} · Week {weekNumber()}
          </div>
        </div>
        <Link href="/chat" aria-label="Coach">
          <CoachOrb size={32} />
        </Link>
      </motion.div>

      {/* Check-in nudge */}
      <motion.div variants={listItem} transition={springContent}>
        <CheckInBadge />
      </motion.div>

      {/* Big Readiness card */}
      <motion.div variants={listItem} transition={springContent}>
        <ExplainTrigger topic="readiness" ariaLabel="Open uitleg over readiness">
        <Card
          className="p-[18px]"
          style={{ background: 'linear-gradient(135deg, #1E2230 0%, #2A3340 100%)' }}
        >
          <div className="flex items-center gap-[18px]">
            <ReadinessOrb value={score / 100} size={108} />
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">Readiness</div>
              <div className="text-[44px] font-bold leading-none tracking-[-1.2px] text-text-primary tabular-nums">{score}</div>
              <div
                className={`mt-0.5 text-[12px] font-medium ${
                  tone === 'good' ? 'text-[var(--color-status-good)]' : tone === 'warn' ? 'text-[var(--color-status-warn)]' : 'text-[var(--color-status-bad)]'
                }`}
              >
                {readinessLbl}
              </div>
            </div>
          </div>
          {summary?.sentence && (
            <p className="mt-3 text-[13px] leading-snug text-text-secondary">
              {summary.sentence}
            </p>
          )}
          {summary?.coldStart?.active && (
            <p className="mt-2 text-[11px] text-text-tertiary" aria-live="polite">
              Pulse leert nog je baseline. Nog{' '}
              <span className="font-semibold text-text-secondary">
                {summary.coldStart.nightsRemaining}{' '}
                {summary.coldStart.nightsRemaining === 1 ? 'nacht' : 'nachten'}
              </span>{' '}
              voor betrouwbare readiness.
            </p>
          )}
          <div className="mt-[18px] grid grid-cols-4 gap-2.5 border-t-[0.5px] border-bg-border pt-3.5">
            <MicroStat label="HRV" value={readiness?.hrv ?? '—'} delta={readiness?.hrv ? 'ms' : undefined} good />
            <MicroStat label="RHR" value={readiness?.restingHR ?? '—'} delta={readiness?.restingHR ? 'bpm' : undefined} good />
            <MicroStat
              label="Slaap"
              value={sleepHours !== null ? `${sleepHours}u ${sleepMins}m` : '—'}
            />
            <MicroStat label="Sessies" value={readiness?.recentSessions ?? '—'} delta="7d" />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDrilldownOpen(true)
            }}
            className="mt-3 w-full rounded-lg border border-bg-border bg-white/[0.04] py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.06] focus-ring"
          >
            Wat bepaalt dit? →
          </button>
        </Card>
        </ExplainTrigger>
      </motion.div>

      <ReadinessDrilldownSheet
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
      />

      {/* Strain bar */}
      {ratio !== null && (
        <motion.div variants={listItem} transition={springContent}>
          <Card className="p-[14px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">
                  Belasting (acute:chronic)
                </div>
                <div className="mt-1 text-[28px] font-bold tracking-[-0.6px] text-text-primary tabular-nums">
                  {ratio.toFixed(2)}{' '}
                  <span
                    className={`text-[13px] font-medium ${
                      ratio >= 0.8 && ratio <= 1.3
                        ? 'text-[var(--color-status-good)]'
                        : 'text-[var(--color-status-warn)]'
                    }`}
                  >
                    {ratio >= 0.8 && ratio <= 1.3 ? 'optimaal' : ratio < 0.8 ? 'licht' : 'opbouw'}
                  </span>
                </div>
              </div>
              <div className="text-[12px] text-text-tertiary">doel 0.8–1.3</div>
            </div>
            <div className="mt-3.5">
              <ZoneBar value={ratioPct} />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Today workout hero */}
      <motion.div variants={listItem} transition={springContent}>
        <TodayWorkoutHero day={todayDay} />
      </motion.div>

      {/* Week strip */}
      {schemaWeek && (
        <motion.div variants={listItem} transition={springContent}>
          <WeekStrip days={schemaWeek.days} />
        </motion.div>
      )}

      {/* Daily health bar (steps etc.) */}
      <motion.div variants={listItem} transition={springContent}>
        <DailyHealthBar />
      </motion.div>

      {/* Body composition */}
      <motion.div variants={listItem} transition={springContent}>
        <BodyCompositionCard />
      </motion.div>

      {/* Muscle heatmap */}
      <motion.div variants={listItem} transition={springContent}>
        <MuscleMapCard />
      </motion.div>

      {/* Sync */}
      <motion.div variants={listItem} transition={springContent}>
        <SyncButton />
      </motion.div>
    </motion.div>
  )
}
