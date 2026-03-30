import useSWR from 'swr'
import type { DashboardData } from '@/app/api/dashboard/route'

async function fetcher(url: string): Promise<DashboardData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useDashboardData() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>('/api/dashboard', fetcher, {
    refreshInterval: 60_000,
  })

  return {
    data,
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
