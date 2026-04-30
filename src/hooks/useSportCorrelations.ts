import useSWR from 'swr'
import type { SportCorrelations } from '@/lib/load/sport-correlations'

async function fetcher(url: string): Promise<SportCorrelations> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useSportCorrelations() {
  const { data, error, isLoading } = useSWR<SportCorrelations>(
    '/api/belasting/correlations',
    fetcher,
    { refreshInterval: 300_000 },
  )

  return { data, error: error as Error | undefined, isLoading }
}
