'use client'

import type { Database } from '@/types/database'

type TrainingSchemaRow = Database['public']['Tables']['training_schemas']['Row']

export interface TrainingBlockIndicatorProps {
  schema: TrainingSchemaRow | null
}

function getPhaseLabel(currentWeek: number, totalWeeks: number): string {
  const progress = currentWeek / totalWeeks
  if (progress < 0.5) return 'Opbouw'
  if (progress < 0.85) return 'Piek'
  return 'Deload'
}

function getPhaseColor(phase: string): string {
  if (phase === 'Opbouw') return '#2E6F6F'
  if (phase === 'Piek') return '#C2410C'
  return '#16A34A'
}

export function TrainingBlockIndicator({ schema }: TrainingBlockIndicatorProps) {
  if (!schema) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border-light bg-bg-subtle p-4"
      >
        <p className="text-sm text-text-tertiary">
          Geen actief trainingsschema
        </p>
      </div>
    )
  }

  const totalWeeks = schema.weeks_planned ?? 12
  const startDate = new Date(schema.start_date)
  const today = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const currentWeek = Math.min(
    Math.max(Math.floor((today.getTime() - startDate.getTime()) / msPerWeek) + 1, 1),
    totalWeeks,
  )

  const pct = (currentWeek / totalWeeks) * 100
  const phase = getPhaseLabel(currentWeek, totalWeeks)
  const phaseColor = getPhaseColor(phase)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          {schema.title}
        </span>
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${phaseColor}22`, color: phaseColor }}
        >
          {phase}
        </span>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: phaseColor }}
        />
      </div>

      <p className="text-xs text-text-tertiary">
        Week {currentWeek} van {totalWeeks}
      </p>
    </div>
  )
}
