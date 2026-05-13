import { useState, useCallback } from 'react'
import type { PlannedSession, WeekPlan } from '@/types/check-in'

export type { PlannedSession, WeekPlan }

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWeekPlan() {
  const [plan, setPlan] = useState<WeekPlan | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generate = useCallback(async (weekStart: string, weekEnd: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/check-in/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed: ${res.status}`)
      }

      const data: WeekPlan = await res.json()
      setPlan(data)
      return data
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err))
      setError(wrapped)
      throw wrapped
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setPlan(null)
    setError(null)
  }, [])

  return { plan, isLoading, error, generate, reset }
}
