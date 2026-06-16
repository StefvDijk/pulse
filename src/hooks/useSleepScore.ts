import useSWR from 'swr'
import type { SleepScoreResponse } from '@/lib/sleep/compute'

async function fetcher(url: string): Promise<SleepScoreResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useSleepScore() {
  const { data, error, isLoading, mutate } = useSWR<SleepScoreResponse>(
    '/api/sleep/score',
    fetcher,
    // Score depends on baselines refreshed by the nightly cron; hourly is plenty.
    { refreshInterval: 60 * 60 * 1000 },
  )

  return { data, error: error as Error | undefined, isLoading, refresh: () => mutate() }
}
