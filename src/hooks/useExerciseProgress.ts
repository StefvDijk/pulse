import useSWR from 'swr'
import type { ExerciseProgressResponse } from '@/types/api'

async function fetcher(url: string): Promise<ExerciseProgressResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useExerciseProgress(name: string | null) {
  const { data, error, isLoading } = useSWR<ExerciseProgressResponse>(
    name ? `/api/progress/exercise?name=${encodeURIComponent(name)}` : null,
    fetcher,
  )

  return {
    data,
    error: error as Error | undefined,
    isLoading,
  }
}
