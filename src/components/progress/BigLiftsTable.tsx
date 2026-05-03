'use client'

import type { BigLift } from '@/app/api/progress/big-lifts/route'

interface BigLiftsTableProps {
  bigLifts: BigLift[]
  onSelect?: (exerciseName: string) => void
}

export function BigLiftsTable({ bigLifts, onSelect }: BigLiftsTableProps) {
  if (bigLifts.length === 0) {
    return (
      <p className="text-caption1 text-text-tertiary">
        Nog niet genoeg data — train minimaal 2× dezelfde oefening.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {bigLifts.map((lift, i) => {
        const positive = lift.deltaKg > 0
        const neutral = lift.deltaKg === 0

        return (
          <button
            key={lift.exerciseName}
            type="button"
            onClick={() => onSelect?.(lift.exerciseName)}
            className={`flex items-center gap-3 py-3 text-left transition-colors hover:bg-bg-elevated ${
              i > 0 ? 'border-t-[0.5px] border-bg-border' : ''
            }`}
          >
            {/* Name + start context */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-subhead font-semibold text-text-primary">
                {lift.exerciseName}
              </p>
              <p className="text-caption2 text-text-tertiary">
                Start: {lift.baselineWeight}kg · {lift.weeksSinceStart}w geleden
              </p>
            </div>

            {/* Current */}
            <div className="flex flex-col items-end">
              <span className="text-callout font-bold tabular-nums text-text-primary">
                {lift.currentWeight}
                <span className="text-caption2 font-normal text-text-tertiary">kg</span>
              </span>
              <span
                className={`text-caption2 font-semibold tabular-nums ${
                  neutral
                    ? 'text-text-tertiary'
                    : positive
                      ? 'text-[var(--color-status-good)]'
                      : 'text-[var(--color-status-bad)]'
                }`}
              >
                {positive ? '+' : ''}
                {lift.deltaKg}kg ({positive ? '+' : ''}
                {lift.deltaPct}%)
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
