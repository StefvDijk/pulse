'use client'

import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useSchemaWeek } from '@/hooks/useSchemaWeek'
import { TodaysMove } from '@/components/home/TodaysMove'
import { HomeHero } from '@/components/home/HomeHero'
import { PulseTriad } from '@/components/home/PulseTriad'
import { BodyCompositionCard } from '@/components/home/BodyCompositionCard'
import { ReadinessSignal } from '@/components/home/ReadinessSignal'
import { CheckInBadge } from '@/components/home/CheckInBadge'
import { TodayWorkoutCard } from '@/components/home/TodayWorkoutCard'
import { WeekAtAGlance } from '@/components/home/WeekAtAGlance'
import { DailyHealthBar } from '@/components/home/DailyHealthBar'
import { SyncButton } from '@/components/home/SyncButton'
import { MuscleMapCard } from '@/components/dashboard/MuscleMapCard'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { listContainer, listItem, springContent } from '@/lib/motion-presets'
import { formatTime } from '@/lib/time/amsterdam'

function getGreeting(): string {
  const hour = Number(formatTime(new Date()).slice(0, 2))
  if (hour < 6) return 'Goedenacht'
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <SkeletonCard className="flex flex-col gap-3">
        <SkeletonLine width="w-2/5" />
        <SkeletonLine width="w-1/4" height="h-3" />
        <SkeletonRect height="h-32" />
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-2">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-8 flex-1 rounded-full bg-system-gray6" />
          ))}
        </div>
      </SkeletonCard>
      <div className="grid grid-cols-3 gap-3">
        <SkeletonCard className="flex flex-col items-center gap-2">
          <SkeletonLine width="w-1/2" />
          <SkeletonLine width="w-2/3" height="h-3" />
        </SkeletonCard>
        <SkeletonCard className="flex flex-col items-center gap-2">
          <SkeletonLine width="w-1/2" />
          <SkeletonLine width="w-2/3" height="h-3" />
        </SkeletonCard>
        <SkeletonCard className="flex flex-col items-center gap-2">
          <SkeletonLine width="w-1/2" />
          <SkeletonLine width="w-2/3" height="h-3" />
        </SkeletonCard>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: schemaWeek, error: schemaError, isLoading: schemaLoading, today, refresh: refreshSchema } = useSchemaWeek()

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  const todayDay = today ?? schemaWeek?.days?.find((d) => d.date === todayStr) ?? null

  const tomorrowWorkout = useMemo(() => {
    if (!schemaWeek || !todayDay) return null
    const todayIndex = schemaWeek.days.findIndex((d) => d.date === todayDay.date)
    if (todayIndex === -1 || todayIndex >= schemaWeek.days.length - 1) return null
    return schemaWeek.days[todayIndex + 1]?.workout?.title ?? null
  }, [schemaWeek, todayDay])

  if (schemaLoading) {
    return <HomeSkeleton />
  }

  if (schemaError) {
    return (
      <div className="p-4">
        <ErrorAlert
          message="Kan homepage niet laden."
          onRetry={refreshSchema}
        />
      </div>
    )
  }

  const greeting = getGreeting()
  const firstName = schemaWeek?.displayName?.split(' ')[0] ?? ''

  return (
    <motion.div
      className="flex flex-col gap-4 p-4"
      variants={listContainer}
      initial="initial"
      animate="animate"
    >
      {/* Greeting */}
      <motion.h1
        variants={listItem}
        transition={springContent}
        className="text-title1 font-bold tracking-tight text-label-primary"
      >
        {greeting}{firstName ? `, ${firstName}` : ''}
      </motion.h1>

      {/* Check-in nudge (Sa/Su/Mo only, hides after review) */}
      <motion.div variants={listItem} transition={springContent}>
        <CheckInBadge />
      </motion.div>

      {/* Today's Move — ritual hero card (UXR-080).
        * Sits above HomeHero on purpose: coaching tone + action button.
        * HomeHero stays below as the data headline. */}
      <motion.div variants={listItem} transition={springContent}>
        <TodaysMove />
      </motion.div>

      {/* Home Hero — editorial-scale day metric (UXR-040) */}
      <motion.div variants={listItem} transition={springContent}>
        <HomeHero day={todayDay ?? undefined} />
      </motion.div>

      {/* Pulse Triad — Train · Recover · Fuel rings (UXR-060) */}
      <motion.div variants={listItem} transition={springContent}>
        <PulseTriad />
      </motion.div>

      {/* Readiness Signal — the "how does today feel" card */}
      <motion.div variants={listItem} transition={springContent}>
        <ReadinessSignal />
      </motion.div>

      {/* Today's workout */}
      <motion.div variants={listItem} transition={springContent}>
        <TodayWorkoutCard
          day={todayDay ?? undefined}
          tomorrowWorkout={tomorrowWorkout}
        />
      </motion.div>

      {/* Week at a glance */}
      {schemaWeek && (
        <motion.div variants={listItem} transition={springContent}>
          <WeekAtAGlance days={schemaWeek.days} />
        </motion.div>
      )}

      {/* Daily health metrics (steps, HR, HRV, sleep, weight) */}
      <motion.div variants={listItem} transition={springContent}>
        <DailyHealthBar />
      </motion.div>

      {/* Body composition trend — 4 weeks (UXR-090) */}
      <motion.div variants={listItem} transition={springContent}>
        <BodyCompositionCard />
      </motion.div>

      {/* Muscle heatmap — last 7 days */}
      <motion.div variants={listItem} transition={springContent}>
        <MuscleMapCard />
      </motion.div>

      {/* Sync button */}
      <motion.div variants={listItem} transition={springContent}>
        <SyncButton />
      </motion.div>
    </motion.div>
  )
}
