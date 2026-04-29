'use client'

import { useTimeOfDay } from '@/hooks/useTimeOfDay'

/**
 * Renders a fixed, subtle ambient gradient behind the rest of the app.
 * Tints with the time of day (dawn / day / dusk / night). Effect is low-alpha
 * by design — the user perceives it without consciously noticing it.
 */
export function TimeOfDayTheme() {
  const period = useTimeOfDay()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 transition-[background] duration-[1500ms] ease-out"
      style={{ background: `var(--gradient-time-${period})` }}
    />
  )
}
