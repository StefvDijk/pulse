import useSWR from 'swr'
import type { PendingFeedbackResponse } from '@/app/api/sessions/pending-feedback/route'
import type { RecentSession } from '@/lib/training/session-feedback'

async function fetcher(url: string): Promise<PendingFeedbackResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Sessions imported in the last week that still await an (optional) note.
 * Drives the home feedback nudge. Manual refresh only — the list only changes
 * after a sync or a save, both of which call `refresh()`.
 */
export function useSessionFeedback() {
  const { data, error, isLoading, mutate } = useSWR<PendingFeedbackResponse>(
    '/api/sessions/pending-feedback',
    fetcher,
    { revalidateOnFocus: false },
  )

  return {
    pending: data?.pending ?? [],
    isLoading,
    error: error as Error | undefined,
    refresh: () => mutate(),
  }
}

export type { RecentSession }
