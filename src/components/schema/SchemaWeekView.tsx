'use client'

import { useState } from 'react'
import { useSchemaWeek } from '@/hooks/useSchemaWeek'
import { useSettings } from '@/hooks/useSettings'
import { WorkoutCard } from './WorkoutCard'
import { PlanWeekModal } from './PlanWeekModal'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { EmptyState } from '@/components/shared/EmptyState'
import { ClipboardList, Calendar } from 'lucide-react'

function getIsoWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00Z')
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function SchemaWeekSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonCard className="flex flex-col gap-2">
        <SkeletonLine width="w-1/3" />
        <SkeletonLine width="w-1/4" height="h-3" />
      </SkeletonCard>
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-system-gray6 shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1">
            <SkeletonLine width="w-1/3" />
            <SkeletonLine width="w-1/2" height="h-3" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  )
}

export function SchemaWeekView() {
  const { data, error, isLoading, refresh } = useSchemaWeek()
  const { data: settings } = useSettings()
  const [modalOpen, setModalOpen] = useState(false)

  const calendarConnected = !!settings?.settings.google_calendar_email

  if (isLoading) {
    return <SchemaWeekSkeleton />
  }

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
    return <ErrorAlert message="Kan schema niet laden." onRetry={refresh} />
  }

  if (!data) return null

  const weekNumber = getIsoWeekNumber(data.days[0].date)
  const completedCount = data.days.filter((d) => d.status === 'completed').length
  const plannedCount = data.days.filter((d) => d.status !== 'rest').length

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-label-primary">
              Week {weekNumber} · {data.schemaTitle}
            </h2>
            <p className="text-sm text-label-tertiary mt-0.5">
              {data.days[0].date.slice(5)} – {data.days[6].date.slice(5)}
              {' · '}
              {completedCount}/{plannedCount} sessies
            </p>
          </div>

          {calendarConnected ? (
            <button
              onClick={() => setModalOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-system-blue px-3 py-1.5 text-xs font-medium text-white"
            >
              <Calendar size={13} />
              Plan in agenda
            </button>
          ) : (
            <a
              href="/settings"
              className="shrink-0 text-xs text-label-tertiary underline-offset-2 hover:underline"
            >
              Koppel agenda
            </a>
          )}
        </div>

        {/* Full week — workout cards + rest day indicators */}
        <div className="flex flex-col gap-3">
          {data.days.map((day) => (
            day.status === 'rest' ? (
              <div key={day.date} className="flex items-center gap-3 px-4 py-2 opacity-40">
                <span className="text-xs font-medium text-label-tertiary w-6 text-center">{day.dayLabel}</span>
                <span className="text-xs text-label-tertiary">Rustdag</span>
              </div>
            ) : (
              <WorkoutCard key={day.date} day={day} />
            )
          ))}
        </div>
      </div>

      {modalOpen && (
        <PlanWeekModal onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
