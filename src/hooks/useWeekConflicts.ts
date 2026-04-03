import useSWR from 'swr'
import type { WeekConflicts } from '@/lib/google/conflicts'

/* ── Fetcher ─────────────────────────────────────────────── */

async function fetcher([url, weekStart, weekEnd]: [string, string, string]): Promise<WeekConflicts> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekStart, weekEnd }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }

  return res.json()
}

/* ── Hook ────────────────────────────────────────────────── */

export function useWeekConflicts(weekStart: string | null, weekEnd: string | null) {
  const key = weekStart && weekEnd
    ? ['/api/check-in/plan/conflicts', weekStart, weekEnd] as [string, string, string]
    : null

  const { data, error, isLoading, mutate } = useSWR<WeekConflicts>(
    key,
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    conflicts: data ?? null,
    error: error as Error | undefined,
    isLoading,
    refresh: mutate,
  }
}
