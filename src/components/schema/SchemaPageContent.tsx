'use client'

import { useState } from 'react'
import { mutate as globalMutate } from 'swr'
import { useSchema } from '@/hooks/useSchema'
import { useSettings } from '@/hooks/useSettings'
import { SchemaProgress } from './SchemaProgress'
import { SchemaOverview } from './SchemaOverview'
import { SchemaCalendar } from './SchemaCalendar'
import { PlanWeekModal } from './PlanWeekModal'
import { SchemaBlockHeader, SchemaCoachNudge } from './v2'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { ClipboardList } from 'lucide-react'
import type { SchemaScheduleItem } from '@/hooks/useSchema'

// Revalidates the /api/schema/week SWR cache for any subscriber
// (home cards, schema week view, PlanWeekModal when open).
function refreshSchemaWeek() {
  globalMutate('/api/schema/week')
}

function getIsoWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00Z')
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function SchemaPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-[64px] pb-24">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
        <div className="h-8 w-2/3 rounded-xl bg-white/[0.06]" />
        <div className="h-3 w-1/3 rounded-full bg-white/[0.06]" />
        <div className="mt-1 h-1.5 rounded-full bg-white/[0.06]" />
      </div>
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
    refreshSchemaWeek()
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
    refreshSchemaWeek()
  }

  // Derive ISO week number from the current week's first day
  const currentWeekData = data.weeks[data.currentWeek - 1]
  const weekLabel = currentWeekData?.days[0]?.date
    ? `Week ${getIsoWeekNumber(currentWeekData.days[0].date)}`
    : `Week ${data.currentWeek}`

  const isLastWeek = data.currentWeek >= data.totalWeeks
  const nudgeMessage = isLastWeek
    ? 'Schema klaar! Plan het volgende blok via de Coach.'
    : `Schema klaar volgende week. Plan blok ${data.currentWeek + 1} via de Coach.`

  return (
    <div className="flex flex-col pb-24">
      {/* v2 header — title, week label, block progress bar */}
      <SchemaBlockHeader
        title={data.title}
        weekLabel={weekLabel}
        weekOfBlock={data.currentWeek}
        totalWeeks={data.totalWeeks}
        sessionsCompleted={data.totalSessionsCompleted}
        sessionsPlanned={data.totalSessionsPlanned}
      />

      <div className="flex flex-col gap-3 px-4">
        {/* Block-level progress segments */}
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

        {/* Schema overview (collapsible workout template list) */}
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
            refreshSchemaWeek()
          }}
        />

        {/* Coach nudge card */}
        <SchemaCoachNudge message={nudgeMessage} />
      </div>

      {/* Google Calendar modal — fetches its own week data on mount */}
      {calendarModalOpen && (
        <PlanWeekModal onClose={() => setCalendarModalOpen(false)} />
      )}
    </div>
  )
}
