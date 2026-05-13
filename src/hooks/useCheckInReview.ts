import useSWR from 'swr'
import type { CheckInReviewData } from '@/types/check-in'

async function fetcher(url: string): Promise<CheckInReviewData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useCheckInReview(weekStart?: string) {
  const url = weekStart
    ? `/api/check-in/review?week_start=${weekStart}`
    : '/api/check-in/review'

  const { data, error, isLoading, mutate } = useSWR<CheckInReviewData>(
    url,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    data,
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
