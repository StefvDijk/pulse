import useSWR from 'swr'
import type { ReadinessData } from '@/types/readiness'

async function fetcher(url: string): Promise<ReadinessData> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useReadiness() {
  const { data, error, isLoading } = useSWR<ReadinessData>(
    '/api/readiness',
    fetcher,
    { refreshInterval: 300_000 },
  )

  return { data, error: error as Error | undefined, isLoading }
}
