'use client'

import useSWR from 'swr'

export interface TodayCheckin {
  id: string
  date: string
  feeling: number
  sleep_quality: number
  note: string | null
  updated_at: string
}

interface CheckinResponse {
  date: string
  checkin: TodayCheckin | null
}

async function fetcher(url: string): Promise<CheckinResponse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

/**
 * Today's quick check-in (feeling / sleep_quality / note), shared by the home
 * badge and the CoachCard trigger. SWR dedupes the request across consumers.
 */
export function useTodayCheckin() {
  const { data, error, isLoading, mutate } = useSWR<CheckinResponse>(
    '/api/check-in/quick',
    fetcher,
    { revalidateOnFocus: false },
  )
  return {
    checkin: data?.checkin ?? null,
    isLoading,
    error,
    mutate,
  }
}
