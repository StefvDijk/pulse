'use client'

import useSWR from 'swr'
import { BriefingCard } from './BriefingCard'
import type { Nudge } from '@/components/coach/nudge-types'

interface BriefingResponse {
  items: Nudge[]
}

async function fetcher(url: string): Promise<BriefingResponse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Briefing kon niet laden')
  return res.json() as Promise<BriefingResponse>
}

/**
 * DailyBriefing — Home's morning briefing (issue #43). Fetches the server-built
 * briefing (top ~3 cross-coach nudges for today) and renders it; shows nothing
 * when there's nothing to brief, so Home stays calm on a quiet day.
 */
export function DailyBriefing() {
  const { data } = useSWR<BriefingResponse>('/api/briefing', fetcher, { refreshInterval: 300_000 })
  return <BriefingCard items={data?.items ?? []} />
}
