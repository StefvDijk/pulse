import useSWR from 'swr'
import type { ExerciseListItem } from '@/app/api/progress/exercises/route'

interface ExerciseListResponse {
  exercises: ExerciseListItem[]
}

async function fetcher(url: string): Promise<ExerciseListResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useExerciseList() {
  const { data, error, isLoading } = useSWR<ExerciseListResponse>(
    '/api/progress/exercises',
    fetcher,
  )

  return {
    exercises: data?.exercises ?? [],
    error: error as Error | undefined,
    isLoading,
  }
}
