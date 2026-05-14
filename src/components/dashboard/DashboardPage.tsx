'use client'

import { motion } from 'motion/react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { useSchemaWeek } from '@/hooks/useSchemaWeek'
import { useReadiness } from '@/hooks/useReadiness'
import { useReadinessSummary } from '@/hooks/useReadinessSummary'
import { useWorkload } from '@/hooks/useWorkload'
import { Card, ZoneBar } from '@/components/ui/v2'
import { CheckInBadge } from '@/components/home/CheckInBadge'
import { DailyHealthBar } from '@/components/home/DailyHealthBar'
import { BodyCompositionCard } from '@/components/home/BodyCompositionCard'
import { SyncButton } from '@/components/home/SyncButton'
import { MuscleMapCard } from '@/components/dashboard/MuscleMapCard'
import { ReadinessCard } from '@/components/dashboard/v2/ReadinessCard'
import { TodayHero } from '@/components/dashboard/v2/TodayHero'
import { WeekGlance } from '@/components/dashboard/v2/WeekGlance'
import { CoachInsightCard } from '@/components/dashboard/v2/CoachInsightCard'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { listContainer, listItem, springContent } from '@/lib/motion-presets'
import Link from 'next/link'

// ── Date helpers ─────────────────────────────────────────────────────────────

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

// ── Sport detection ──────────────────────────────────────────────────────────

type Sport = 'gym' | 'run' | 'padel' | 'cycle'

function sportFor(type: string | null | undefined): Sport {
  const t = (type ?? '').toLowerCase()
  if (t.includes('run') || t.includes('hardlop')) return 'run'
  if (t.includes('padel')) return 'padel'
  if (t.includes('cycle') || t.includes('fiets')) return 'cycle'
  return 'gym'
}

// ── Readiness helpers ────────────────────────────────────────────────────────

function readinessScore(level: string | undefined): number {
  if (level === 'good') return 86
  if (level === 'normal') return 68
  if (level === 'fatigued') return 48
  return 38
}

function readinessLabel(level: string | undefined): {
  label: string
  tone: 'good' | 'warn' | 'bad'
} {
  if (level === 'good') return { label: 'Goed hersteld', tone: 'good' }
  if (level === 'normal') return { label: 'Op koers', tone: 'good' }
  if (level === 'fatigued') return { label: 'Vermoeid', tone: 'warn' }
  return { label: 'Rustdag aanbevolen', tone: 'bad' }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 pt-16">
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-2/5" />
        <SkeletonRect height="h-24" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonRect height="h-32" />
      </SkeletonCard>
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCard>
          <SkeletonLine width="w-2/3" />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonLine width="w-2/3" />
        </SkeletonCard>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const sport = sportFor(todayDay?.workout?.type)
  const ratio = workload?.ratio ?? readiness?.acwr ?? null
  const ratioPct = ratio !== null ? Math.max(0, Math.min(1, ratio / 2.0)) : 0.5

  return (
    <motion.div
      className="flex flex-col gap-3 px-4 pt-16 pb-4"
      variants={listContainer}
      initial="initial"
      animate="animate"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        variants={listItem}
        transition={springContent}
        className="flex items-end justify-between pb-1"
      >
        <div>
          <div className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">
            Vandaag
          </div>
          <div className="mt-0.5 text-[13px] text-text-secondary">
            {formatDate()} · Week {weekNumber()}
          </div>
        </div>
        <Link href="/chat" aria-label="Ga naar Coach">
          <CoachOrb size={32} />
        </Link>
      </motion.div>

      {/* ── Check-in nudge (weekend/monday only) ──────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <CheckInBadge />
      </motion.div>

      {/* ── Readiness card ────────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <ReadinessCard
          readiness={readiness}
          summary={summary}
          score={score}
          label={readinessLbl}
          tone={tone}
        />
      </motion.div>

      {/* ── Workload / strain bar (only when data is available) ── */}
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
                    {ratio >= 0.8 && ratio <= 1.3
                      ? 'optimaal'
                      : ratio < 0.8
                        ? 'licht'
                        : 'opbouw'}
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

      {/* ── Today workout hero ────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <TodayHero day={todayDay} sport={sport} />
      </motion.div>

      {/* ── Week glance strip ─────────────────────────────────── */}
      {schemaWeek && (
        <motion.div variants={listItem} transition={springContent}>
          <WeekGlance days={schemaWeek.days} />
        </motion.div>
      )}

      {/* ── Daily health bar (steps, RHR, HRV, sleep) ────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <DailyHealthBar />
      </motion.div>

      {/* ── Body composition ──────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <BodyCompositionCard />
      </motion.div>

      {/* ── Muscle heatmap ────────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <MuscleMapCard />
      </motion.div>

      {/* ── Coach insight card ────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <CoachInsightCard insight={summary?.sentence} />
      </motion.div>

      {/* ── Sync utility ──────────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <SyncButton />
      </motion.div>
    </motion.div>
  )
}
