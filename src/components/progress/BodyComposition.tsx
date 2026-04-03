'use client'

import { Scale } from 'lucide-react'
import type { Database } from '@/types/database'

type PRRow = Database['public']['Tables']['personal_records']['Row']

interface BodyCompositionProps {
  records: PRRow[]
}

const BODY_COMP_TYPES = ['muscle_mass', 'fat_mass', 'body_fat_percentage'] as const

const LABELS: Record<string, string> = {
  muscle_mass: 'Spiermassa',
  fat_mass: 'Vetmassa',
  body_fat_percentage: 'Vetpercentage',
}

export function BodyComposition({ records }: BodyCompositionProps) {
  // Filter to body composition records
  const bodyRecords = records.filter(
    (r) => BODY_COMP_TYPES.includes(r.record_type as typeof BODY_COMP_TYPES[number]),
  )

  if (bodyRecords.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center">
        <p className="text-sm text-text-tertiary">
          Nog geen InBody data — voeg scans toe via de Coach
        </p>
      </div>
    )
  }

  // Get the most recent record per type
  const latestByType = new Map<string, PRRow>()
  for (const r of bodyRecords) {
    const existing = latestByType.get(r.record_type)
    if (!existing || r.achieved_at > existing.achieved_at) {
      latestByType.set(r.record_type, r)
    }
  }

  const latestDate = Array.from(latestByType.values())
    .map((r) => r.achieved_at)
    .sort()
    .pop()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {BODY_COMP_TYPES.map((type) => {
          const record = latestByType.get(type)
          if (!record) return null

          const delta =
            record.previous_record !== null
              ? record.value - record.previous_record
              : null

          // For fat_mass and body_fat_percentage, decrease is good
          const isPositiveChange =
            type === 'muscle_mass' ? (delta ?? 0) >= 0 : (delta ?? 0) <= 0

          return (
            <div key={type} className="flex flex-col items-center text-center">
              <p className="text-xs text-text-tertiary">{LABELS[type]}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {record.value}
                <span className="text-xs font-normal text-text-tertiary ml-0.5">
                  {record.unit}
                </span>
              </p>
              {delta !== null && (
                <span
                  className={`text-xs font-medium ${
                    isPositiveChange ? 'text-status-green' : 'text-status-red'
                  }`}
                >
                  {delta >= 0 ? '+' : ''}
                  {delta % 1 === 0 ? delta : delta.toFixed(1)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {latestDate && (
        <p className="text-xs text-text-tertiary text-center">
          Laatste scan:{' '}
          {new Date(latestDate).toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
