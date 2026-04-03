import useSWR from 'swr'
import type { ActivityFeedResponse, ActivityItem } from '@/app/api/activities/route'

async function fetcher(url: string): Promise<ActivityFeedResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useActivityFeed(page = 1) {
  const { data, error, isLoading, mutate } = useSWR<ActivityFeedResponse>(
    `/api/activities?page=${page}`,
    fetcher,
    { refreshInterval: 0 },
  )

  return {
    activities: data?.activities ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    isLoading,
    error: error as Error | undefined,
    refresh: mutate,
  }
}

export type { ActivityItem }
