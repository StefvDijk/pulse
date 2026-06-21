'use client'

import useSWR from 'swr'
import { NudgeCard } from './NudgeCard'
import type { Nudge, NudgesResponse } from './nudge-types'
import type { LiveCoachId } from '@/lib/ai/coaches/registry'

async function fetcher(url: string): Promise<NudgesResponse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Nudges konden niet laden')
  return res.json() as Promise<NudgesResponse>
}

export interface NudgeListProps {
  /** Restrict to one coach's nudges (a coach tab); omit for all coaches (the inbox). */
  coachId?: LiveCoachId
}

/**
 * NudgeList — renders the active nudges for one coach (its tab) or all coaches
 * (the inbox). Every instance shares the single unscoped '/api/nudges' SWR cache
 * (filtering by coach client-side) so one optimistic dismiss updates the coach
 * tab, the inbox, and the bell badge together. Renders nothing when empty.
 */
export function NudgeList({ coachId }: NudgeListProps) {
  const { data, mutate } = useSWR<NudgesResponse>('/api/nudges', fetcher, { refreshInterval: 60_000 })
  const all = data?.nudges ?? []
  const nudges = coachId ? all.filter((n) => n.coach_id === coachId) : all

  if (nudges.length === 0) return null

  const dismiss = async (id: string) => {
    mutate({ nudges: all.filter((n) => n.id !== id) }, { revalidate: false })
    try {
      await fetch(`/api/nudges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      })
    } finally {
      void mutate()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {nudges.map((n: Nudge) => (
        <NudgeCard key={n.id} nudge={n} onDismiss={dismiss} />
      ))}
    </div>
  )
}
