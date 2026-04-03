import useSWR from 'swr'
import type { CheckInHistoryEntry } from '@/app/api/check-in/history/route'

async function fetcher(url: string): Promise<CheckInHistoryEntry[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function useCheckInHistory(limit = 10) {
  const { data, error, isLoading, mutate } = useSWR<CheckInHistoryEntry[]>(
    `/api/check-in/history?limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    entries: data ?? [],
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
