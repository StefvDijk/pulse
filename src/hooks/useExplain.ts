'use client'

import useSWR from 'swr'
import type { ExplainPayload, ExplainTopic } from '@/lib/explain/topics'

const fetcher = async (url: string): Promise<ExplainPayload> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Explain payload failed (${res.status})`)
  return (await res.json()) as ExplainPayload
}

export function useExplain(topic: ExplainTopic | null, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  const key = topic ? `/api/explain/${topic}${query}` : null

  const { data, error, isLoading, mutate } = useSWR<ExplainPayload>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  })

  return { payload: data, error, isLoading, refresh: mutate }
}
