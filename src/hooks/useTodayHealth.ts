import useSWR from 'swr'
import type { TodayHealthData } from '@/app/api/health/today/route'

async function fetcher(url: string): Promise<TodayHealthData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
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
