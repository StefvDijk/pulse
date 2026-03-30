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
  if (phase === 'Opbouw') return '#4f8cff'
  if (phase === 'Piek') return '#f59e0b'
  return '#22c55e'
}

export function TrainingBlockIndicator({ schema }: TrainingBlockIndicatorProps) {
  if (!schema) {
    return (
      <div
        className="flex items-center justify-center rounded-lg p-4"
        style={{ backgroundColor: '#1a1a2e', borderColor: '#3a3a5c', border: '1px solid' }}
      >
        <p className="text-sm" style={{ color: '#8888a0' }}>
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
        <span className="text-sm font-medium" style={{ color: '#f0f0f5' }}>
          {schema.title}
        </span>
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${phaseColor}22`, color: phaseColor }}
        >
          {phase}
        </span>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full" style={{ backgroundColor: '#1a1a2e' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: phaseColor }}
        />
      </div>

      <p className="text-xs" style={{ color: '#8888a0' }}>
        Week {currentWeek} van {totalWeeks}
      </p>
    </div>
  )
}
