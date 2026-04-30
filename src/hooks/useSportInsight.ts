import useSWR from 'swr'

interface SportInsightResponse {
  insight: string | null
  sourceDate: string | null
  updatedAt: string | null
}

async function fetcher(url: string): Promise<SportInsightResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useSportInsight() {
  const { data, error, isLoading } = useSWR<SportInsightResponse>(
    '/api/belasting/sport-insight',
    fetcher,
  )

  return {
    insight: data?.insight ?? null,
    sourceDate: data?.sourceDate ?? null,
    isLoading,
    error: error as Error | undefined,
  }
}
