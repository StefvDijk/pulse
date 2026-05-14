'use client'

import { CheckCircle2 } from 'lucide-react'

const STEPS = ['Review', 'Analyse', 'Planning', 'Bevestig'] as const
type StepNumber = 1 | 2 | 3 | 4

interface StepIndicatorProps {
  current: StepNumber
}

/**
 * StepIndicator v2 — 4-step progress indicator for the weekly check-in flow.
 * Matches the design ref (screens/More.jsx::CheckIn step indicator).
 * Done steps: green circle with checkmark. Active: blue filled. Pending: glass.
 * Connector lines: green if done, else glass border.
 */
export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const stepNum = (i + 1) as StepNumber
        const isDone = stepNum < current
        const isActive = stepNum === current
        const isLast = i === STEPS.length - 1

        return (
          <div
            key={label}
            className="flex items-center gap-2"
            style={{ flex: isLast ? 'none' : 1 }}
          >
            <div className="flex items-center gap-1.5">
              {/* Circle */}
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{
                  background: isDone
                    ? 'rgba(34,214,122,0.15)'
                    : isActive
                      ? '#0A84FF'
                      : 'rgba(255,255,255,0.08)',
                  color: isDone ? '#22D67A' : isActive ? '#fff' : 'rgba(245,245,247,0.46)',
                }}
              >
                {isDone ? <CheckCircle2 size={13} /> : stepNum}
              </div>

              {/* Label */}
              <span
                className="whitespace-nowrap text-[11px] font-medium"
                style={{
                  color: isActive
                    ? '#F5F5F7'
                    : 'rgba(245,245,247,0.46)',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="h-px flex-1"
                style={{
                  minWidth: 8,
                  background: isDone ? '#22D67A' : 'rgba(255,255,255,0.10)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
