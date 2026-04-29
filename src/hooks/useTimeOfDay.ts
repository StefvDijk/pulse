'use client'

import { useEffect, useState } from 'react'

export type TimePeriod = 'dawn' | 'day' | 'dusk' | 'night'

const FIFTEEN_MIN = 15 * 60 * 1000

export function computeTimePeriod(date: Date): TimePeriod {
  const hour = date.getHours()
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 17) return 'day'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'night'
}

/**
 * Tracks the current quarter-day period and updates every 15 minutes,
 * plus on tab visibility return so a user reopening the app at 8pm sees
 * dusk without having to wait.
 *
 * SSR safety: the initial render returns 'day' so the server-rendered HTML
 * matches deterministically. The real period kicks in on the first effect
 * tick after hydration.
 */
export function useTimeOfDay(): TimePeriod {
  const [period, setPeriod] = useState<TimePeriod>('day')

  useEffect(() => {
    const update = () => setPeriod(computeTimePeriod(new Date()))
    update()

    const interval = setInterval(update, FIFTEEN_MIN)
    const onVisibility = () => {
      if (!document.hidden) update()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return period
}
