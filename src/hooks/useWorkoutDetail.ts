import useSWR from 'swr'
import type { WorkoutDetailResponse } from '@/app/api/workouts/[id]/route'

async function fetcher(url: string): Promise<WorkoutDetailResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useWorkoutDetail(id: string) {
  const { data, error, isLoading } = useSWR<WorkoutDetailResponse>(
    `/api/workouts/${id}`,
    fetcher,
  )

  return {
    workout: data,
    error: error as Error | undefined,
    isLoading,
  }
}

export type { WorkoutDetailResponse }
