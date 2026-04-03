import useSWR from 'swr'
import type { WorkoutsFeedResponse, WorkoutSummary } from '@/app/api/workouts/route'

async function fetcher(url: string): Promise<WorkoutsFeedResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useWorkoutsFeed(page = 1) {
  const { data, error, isLoading, mutate } = useSWR<WorkoutsFeedResponse>(
    `/api/workouts?page=${page}`,
    fetcher,
    { refreshInterval: 0 }, // manual refresh only
  )

  return {
    workouts: data?.workouts ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    isLoading,
    error: error as Error | undefined,
    refresh: mutate,
  }
}

export type { WorkoutSummary }
