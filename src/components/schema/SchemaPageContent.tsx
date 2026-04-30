'use client'

import { useState } from 'react'
import { useSchema } from '@/hooks/useSchema'
import { useSettings } from '@/hooks/useSettings'
import { SchemaProgress } from './SchemaProgress'
import { SchemaOverview } from './SchemaOverview'
import { SchemaCalendar } from './SchemaCalendar'
import { PlanWeekModal } from './PlanWeekModal'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { ClipboardList } from 'lucide-react'
import type { SchemaScheduleItem } from '@/hooks/useSchema'
import type { SchemaWeekDay } from '@/hooks/useSchemaWeek'
import { useSchemaWeek } from '@/hooks/useSchemaWeek'

function SchemaPageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard className="flex flex-col gap-2">
        <SkeletonLine width="w-2/3" />
        <SkeletonLine width="w-1/3" height="h-3" />
        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 h-2 rounded-full bg-white/[0.06]" />
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-2">
        <SkeletonLine width="w-1/3" />
        <SkeletonLine width="w-1/2" height="h-3" />
      </SkeletonCard>
      <SkeletonCard className="h-48">
        <span />
      </SkeletonCard>
    </div>
  )
}

export function SchemaPageContent() {
  const { data, error, isLoading, mutate } = useSchema()
  const { data: weekData, refresh: refreshWeek } = useSchemaWeek()
  const { data: settings } = useSettings()
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)

  const calendarConnected = !!settings?.settings.google_calendar_email

  if (isLoading) return <SchemaPageSkeleton />

  if (error) {
    const isNoSchema = error.message?.includes('No active training schema')
    if (isNoSchema) {
      return (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="Geen actief trainingsschema"
          description="Maak een schema via de Coach of voeg er een toe in de instellingen."
          action={{ label: 'Vraag de Coach', href: '/chat' }}
        />
      )
    }
    return <ErrorAlert message="Kan schema niet laden." onRetry={() => mutate()} />
  }

  if (!data) return null

  async function handleSaveSchedule(schedule: SchemaScheduleItem[]) {
    const res = await fetch('/api/schema', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workout_schedule: schedule }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Opslaan mislukt')
    }

    mutate()
    refreshWeek()
  }

  async function handleReschedule(fromDate: string, toDate: string, workoutFocus: string) {
    const res = await fetch('/api/schema/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDate, toDate, workoutFocus }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Verplaatsen mislukt')
    }

    mutate()
    refreshWeek()
  }

  // Build PlanWeekModal-compatible days from current week data
  const modalDays: SchemaWeekDay[] = weekData?.days ?? []

  return (
    <div className="flex flex-col gap-3 px-4 pb-24 pt-[60px]">
      <div className="pt-1">
        <div className="text-[13px] font-medium text-text-tertiary">Schema</div>
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.6px] text-text-primary">
          {data.title}
        </h1>
      </div>

      {/* Progress indicator */}
      <SchemaProgress
        title={data.title}
        totalWeeks={data.totalWeeks}
        currentWeek={data.currentWeek}
        completedWeeks={data.completedWeeks}
        totalSessionsPlanned={data.totalSessionsPlanned}
        totalSessionsCompleted={data.totalSessionsCompleted}
        weeks={data.weeks}
        startDate={data.startDate}
      />

      {/* Schema overview (collapsible) */}
      <SchemaOverview
        title={data.title}
        schemaType={data.schemaType}
        schedule={data.schedule}
        onSave={handleSaveSchedule}
      />

      {/* Calendar / Agenda */}
      <SchemaCalendar
        weeks={data.weeks}
        currentWeek={data.currentWeek}
        calendarConnected={calendarConnected}
        templateSchedule={data.schedule}
        onReschedule={handleReschedule}
        onPushToCalendar={() => setCalendarModalOpen(true)}
        onSchemaChanged={() => {
          mutate()
          refreshWeek()
        }}
      />

      {/* Google Calendar modal (reused from existing) */}
      {calendarModalOpen && modalDays.length > 0 && (
        <PlanWeekModal
          days={modalDays}
          onClose={() => setCalendarModalOpen(false)}
        />
      )}
    </div>
  )
}
