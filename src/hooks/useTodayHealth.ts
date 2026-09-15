import useSWR from 'swr'
import { z } from 'zod'
import type { TodayHealthData } from '@/app/api/health/today/route'

const measurement = z.number().nonnegative().nullable()
const HealthResponseSchema = z.object({
  date: z.iso.date(), today: z.iso.date(), isStale: z.boolean(),
  lastSyncedAt: z.iso.datetime({ offset: true }).nullable(),
  steps: measurement, active_calories: measurement, total_calories: measurement,
  active_minutes: measurement, resting_heart_rate: measurement,
  hrv_average: measurement, stand_hours: measurement, sleep_minutes: measurement,
  sleep_date: z.iso.date().nullable(),
  weight_kg: measurement, weight_date: z.iso.date().nullable(),
})

async function fetcher(url: string): Promise<TodayHealthData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return HealthResponseSchema.parse(await res.json())
}

export function useTodayHealth() {
  const { data, error, isLoading, mutate } = useSWR<TodayHealthData>(
    '/api/health/today',
    fetcher,
    { refreshInterval: 300_000 },
  )

  return {
    health: data ?? null,
    isLoading,
    error: error as Error | undefined,
    refresh: mutate,
  }
}
