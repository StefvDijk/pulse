'use client'

import { motion } from 'motion/react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { useSchemaWeek } from '@/hooks/useSchemaWeek'
import { useReadiness } from '@/hooks/useReadiness'
import { useReadinessSummary } from '@/hooks/useReadinessSummary'
import { useWorkload } from '@/hooks/useWorkload'
import { useCoachSignal } from '@/hooks/useCoachSignal'
import { Card, ZoneBar } from '@/components/ui/v2'
import { CheckInBadge } from '@/components/home/CheckInBadge'
import { QuickCheckInBadge } from '@/components/home/QuickCheckInBadge'
import { SessionFeedbackNudge } from '@/components/home/SessionFeedbackNudge'
import { DailyHealthBar } from '@/components/home/DailyHealthBar'
import { BodyCompositionCard } from '@/components/home/BodyCompositionCard'
import { MuscleMapCard } from '@/components/dashboard/MuscleMapCard'
import { ReadinessCard } from '@/components/dashboard/v2/ReadinessCard'
import { deriveReadinessView } from '@/components/dashboard/v2/readiness-view'
import { WeekGlance, WeekGlanceSkeleton } from '@/components/dashboard/v2/WeekGlance'
import { RecentActivities } from '@/components/home/RecentActivities'
import { CoachCard } from '@/components/dashboard/v2/CoachCard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { listContainer, listItem, springContent } from '@/lib/motion-presets'
import Link from 'next/link'
import { InboxBell } from '@/components/coach/InboxBell'

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

// ── Readiness helpers ────────────────────────────────────────────────────────

function readinessLabel(level: string | undefined): {
  label: string
  tone: 'good' | 'warn' | 'bad'
} {
  if (level === 'good') return { label: 'Goed hersteld', tone: 'good' }
  if (level === 'normal') return { label: 'Op koers', tone: 'good' }
  if (level === 'fatigued') return { label: 'Vermoeid', tone: 'warn' }
  return { label: 'Rustdag aanbevolen', tone: 'bad' }
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const {
    data: schemaWeek,
    error: schemaError,
    isLoading: schemaLoading,
    refresh: refreshSchema,
  } = useSchemaWeek()
  const {
    data: readiness,
    isLoading: readinessLoading,
    refresh: refreshReadiness,
  } = useReadiness()
  const {
    data: summary,
    isLoading: summaryLoading,
    refresh: refreshSummary,
  } = useReadinessSummary()
  const { data: workload } = useWorkload()
  const { signal: coachSignal } = useCoachSignal()

  // Note: we gaten de hele pagina niet langer op schemaLoading — elke card
  // toont zijn eigen skeleton zodat snelle cards niet wachten op het zwaarste
  // endpoint (BUG B). Alleen een harde schema-error blokkeert nog.
  if (schemaError && !schemaWeek) {
    return (
      <div className="p-4 pt-16">
        <ErrorAlert message="Kan homepage niet laden." onRetry={refreshSchema} />
      </div>
    )
  }

  // Readiness v2: the score is computed server-side (z-scores vs baselines).
  // The client never recomputes or fabricates it — when the endpoints return
  // nothing we show an honest loading/unavailable state instead of a fake score.
  const readinessView = deriveReadinessView({
    summary,
    readiness,
    isLoading: (readinessLoading || summaryLoading) && !readiness && !summary,
  })
  const readinessLevel = readinessView.status === 'ready' ? readinessView.level : undefined
  const { label: readinessLbl, tone } = readinessLabel(readinessLevel)
  const refreshReadinessCard = () => {
    void refreshReadiness()
    void refreshSummary()
  }
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
        <div className="flex items-center gap-3">
          <InboxBell />
          <Link href="/chat" aria-label="Ga naar Coach">
            <CoachOrb size={32} />
          </Link>
        </div>
      </motion.div>

      {/* ── Daily quick check-in (30 sec) ─────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <QuickCheckInBadge />
      </motion.div>

      {/* ── Weekly check-in nudge (weekend/monday only) ───────── */}
      <motion.div variants={listItem} transition={springContent}>
        <CheckInBadge />
      </motion.div>

      {/* ── Post-session feedback nudge (only when a session awaits) ── */}
      <motion.div variants={listItem} transition={springContent}>
        <SessionFeedbackNudge />
      </motion.div>

      {/* ── Readiness card ────────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <ReadinessCard
          view={readinessView}
          readiness={readiness}
          summary={summary}
          label={readinessLbl}
          tone={tone}
          onRetry={refreshReadinessCard}
        />
      </motion.div>

      {/* ── Workload / strain bar (only when data is available) ── */}
      {ratio !== null && (
        <motion.div variants={listItem} transition={springContent}>
          <Link href="/belasting" aria-label="Bekijk belasting" className="block active:scale-[0.99]">
          <Card className="p-[14px] transition-colors hover:border-bg-border-strong">
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
          </Link>
        </motion.div>
      )}

      {/* ── Coach card (only when there's something to say) ─── */}
      {coachSignal && (
        <motion.div variants={listItem} transition={springContent}>
          <CoachCard signalId={coachSignal.signalId} text={coachSignal.text} />
        </motion.div>
      )}

      {/* ── Week glance strip ─────────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        {schemaWeek ? (
          <WeekGlance days={schemaWeek.days} />
        ) : schemaLoading ? (
          <WeekGlanceSkeleton />
        ) : null}
      </motion.div>

      {/* ── Recente activiteiten ──────────────────────────────── */}
      <motion.div variants={listItem} transition={springContent}>
        <RecentActivities />
      </motion.div>

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

    </motion.div>
  )
}
