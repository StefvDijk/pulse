import useSWR from 'swr'
import type { CalendarEvent } from '@/lib/google/calendar'

/* ── Fetcher ─────────────────────────────────────────────── */

async function fetcher(url: string): Promise<CalendarEvent[]> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  const json = await res.json()
  return json.events
}

/* ── Hook ────────────────────────────────────────────────── */

export function useCalendarEvents(startDate: string, endDate: string) {
  const key = startDate && endDate
    ? `/api/calendar/events?start=${startDate}&end=${endDate}`
    : null

  const { data, error, isLoading, mutate } = useSWR<CalendarEvent[]>(
    key,
    fetcher,
  )

  return {
    events: data ?? [],
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
