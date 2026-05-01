import useSWR from 'swr'
import type { ContributorsResponse } from '@/app/api/readiness/contributors/route'

async function fetcher(url: string): Promise<ContributorsResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

/**
 * Lazy-loaded — pass `enabled = false` to skip the fetch until the user opens
 * the drill-down sheet, so we don't pay for it on every home render.
 */
export function useReadinessContributors(enabled: boolean) {
  const { data, error, isLoading } = useSWR<ContributorsResponse>(
    enabled ? '/api/readiness/contributors' : null,
    fetcher,
  )
  return { data, error: error as Error | undefined, isLoading }
}
