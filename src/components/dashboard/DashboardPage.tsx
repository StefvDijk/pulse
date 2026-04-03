'use client'

import { useMemo } from 'react'
import { useSchemaWeek } from '@/hooks/useSchemaWeek'
import { ReadinessSignal } from '@/components/home/ReadinessSignal'
import { CheckInBadge } from '@/components/home/CheckInBadge'
import { TodayWorkoutCard } from '@/components/home/TodayWorkoutCard'
import { WeekAtAGlance } from '@/components/home/WeekAtAGlance'
import { DailyHealthBar } from '@/components/home/DailyHealthBar'
import { SyncButton } from '@/components/home/SyncButton'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'

function getGreeting(): string {
  const hour = new Date().getHours()
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
            <div key={i} className="h-8 flex-1 rounded-full bg-bg-subtle" />
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

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  const todayDay = today ?? schemaWeek?.days.find((d) => d.date === todayStr)

  const tomorrowWorkout = useMemo(() => {
    if (!schemaWeek || !todayDay) return null
    const todayIndex = schemaWeek.days.findIndex((d) => d.date === todayDay.date)
    if (todayIndex === -1 || todayIndex >= schemaWeek.days.length - 1) return null
    return schemaWeek.days[todayIndex + 1]?.workout?.title ?? null
  }, [schemaWeek, todayDay])

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Greeting */}
      <h1 className="text-xl font-semibold text-text-primary">
        {greeting}{firstName ? `, ${firstName}` : ''}
      </h1>

      {/* Check-in nudge (Sa/Su/Mo only, hides after review) */}
      <CheckInBadge />

      {/* Readiness Signal — the "one big thing" */}
      <ReadinessSignal />

      {/* Today's workout */}
      <TodayWorkoutCard
        day={todayDay}
        tomorrowWorkout={tomorrowWorkout}
      />

      {/* Week at a glance */}
      {schemaWeek && <WeekAtAGlance days={schemaWeek.days} />}

      {/* Daily health metrics (steps, HR, HRV, sleep, weight) */}
      <DailyHealthBar />

      {/* Sync button */}
      <SyncButton />
    </div>
  )
}
