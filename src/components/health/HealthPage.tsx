'use client'

import { motion } from 'motion/react'
import { useReadiness } from '@/hooks/useReadiness'
import { useReadinessSummary } from '@/hooks/useReadinessSummary'
import { HealthCoachLauncher } from '@/components/coach/HealthCoachLauncher'
import { ReadinessCard } from '@/components/dashboard/v2/ReadinessCard'
import { deriveReadinessView } from '@/components/dashboard/v2/readiness-view'
import { SleepScoreCard } from '@/components/home/SleepScoreCard'
import { DailyHealthBar } from '@/components/home/DailyHealthBar'
import { BodyCompositionCard } from '@/components/home/BodyCompositionCard'
import { listContainer, listItem, springContent } from '@/lib/motion-presets'

function readinessLabel(level: string | undefined): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (level === 'good') return { label: 'Goed hersteld', tone: 'good' }
  if (level === 'normal') return { label: 'Op koers', tone: 'good' }
  if (level === 'fatigued') return { label: 'Vermoeid', tone: 'warn' }
  return { label: 'Rustdag aanbevolen', tone: 'bad' }
}

/**
 * HealthPage — the Gezondheid tab (issue #39): the gezondheidscoach's room.
 * Its chat launcher plus the recovery surfaces (readiness, sleep, daily health,
 * body composition), reusing the same honest, server-computed data as Home.
 */
export function HealthPage() {
  const { data: readiness, isLoading: readinessLoading, refresh: refreshReadiness } = useReadiness()
  const { data: summary, isLoading: summaryLoading, refresh: refreshSummary } = useReadinessSummary()

  const readinessView = deriveReadinessView({
    summary,
    readiness,
    isLoading: (readinessLoading || summaryLoading) && !readiness && !summary,
  })
  const readinessLevel = readinessView.status === 'ready' ? readinessView.level : undefined
  const { label, tone } = readinessLabel(readinessLevel)
  const refreshReadinessCard = () => {
    void refreshReadiness()
    void refreshSummary()
  }

  return (
    <motion.div
      className="flex flex-col gap-3 px-4 pt-16 pb-4"
      variants={listContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={listItem} transition={springContent} className="pb-1">
        <div className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">Gezondheid</div>
        <div className="mt-0.5 text-[13px] text-text-secondary">Herstel, slaap & readiness</div>
      </motion.div>

      <motion.div variants={listItem} transition={springContent}>
        <HealthCoachLauncher />
      </motion.div>

      <motion.div variants={listItem} transition={springContent}>
        <ReadinessCard
          view={readinessView}
          readiness={readiness}
          summary={summary}
          label={label}
          tone={tone}
          onRetry={refreshReadinessCard}
        />
      </motion.div>

      <motion.div variants={listItem} transition={springContent}>
        <SleepScoreCard />
      </motion.div>

      <motion.div variants={listItem} transition={springContent}>
        <DailyHealthBar />
      </motion.div>

      <motion.div variants={listItem} transition={springContent}>
        <BodyCompositionCard />
      </motion.div>
    </motion.div>
  )
}
