import useSWR from 'swr'

export interface GoalSparklinePoint {
  date: string
  weight: number
}

interface SparklineResponse {
  exerciseName: string | null
  points: GoalSparklinePoint[]
}

async function fetcher(url: string): Promise<SparklineResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json()
}

export function useGoalSparkline(goalId: string, enabled = true) {
  const { data, isLoading } = useSWR<SparklineResponse>(
    enabled ? `/api/goals/${goalId}/sparkline` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    exerciseName: data?.exerciseName ?? null,
    points: data?.points ?? [],
    isLoading,
  }
}
