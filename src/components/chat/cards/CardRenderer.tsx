'use client'

import type { AnyCard } from '@/lib/ai/chat/cards'
import { WorkoutCard } from './WorkoutCard'
import { WeekplanCard } from './WeekplanCard'
import { StatCard } from './StatCard'
import { WritebackCard } from './WritebackCard'

export interface CardRendererProps {
  card: AnyCard
}

export function CardRenderer({ card }: CardRendererProps) {
  if (card.type === 'workout') return <WorkoutCard data={card} />
  if (card.type === 'weekplan_card') return <WeekplanCard data={card} />
  if (card.type === 'stat_card') return <StatCard data={card} />
  if (card.type === 'writeback_card') return <WritebackCard data={card} />
  // TypeScript: card has type `never` here — future-safe no-op
  return null
}
