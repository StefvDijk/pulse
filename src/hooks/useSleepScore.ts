import useSWR from 'swr'
import { z } from 'zod'
import type { SleepScoreResponse } from '@/lib/sleep/compute'

const SleepResponseSchema = z.object({
  date: z.iso.date().nullable(),
  generatedAt: z.iso.datetime({ offset: true }),
  score: z.number().int().min(0).max(100).nullable(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  components: z.array(z.object({
    key: z.enum(['duration', 'bedtime', 'interruptions', 'stages']),
    scored: z.number().nonnegative(),
    available: z.number().nonnegative(),
    skipped: z.boolean(),
  })),
}).refine(value => value.score === null || value.date !== null, {
  message: 'A sleep score must identify its night',
})

async function fetcher(url: string): Promise<SleepScoreResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return SleepResponseSchema.parse(await res.json())
}

export function useSleepScore() {
  const { data, error, isLoading, mutate } = useSWR<SleepScoreResponse>(
    '/api/sleep/score',
    fetcher,
    // Score depends on baselines refreshed by the nightly cron; hourly is plenty.
    { refreshInterval: 60 * 60 * 1000 },
  )

  return { data, error: error as Error | undefined, isLoading, refresh: () => mutate() }
}
