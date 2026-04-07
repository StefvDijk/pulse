'use client'

import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useWorkoutsFeed } from '@/hooks/useWorkoutsFeed'
import { WorkoutFeedCard } from './WorkoutFeedCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="flex flex-col gap-3">
          <div className="flex justify-between">
            <SkeletonLine width="w-1/3" />
            <SkeletonLine width="w-1/4" height="h-3" />
          </div>
          <div className="flex gap-3">
            <SkeletonLine width="w-12" height="h-3" />
            <SkeletonLine width="w-16" height="h-3" />
          </div>
          <SkeletonRect height="h-20" />
        </SkeletonCard>
      ))}
    </div>
  )
}

export function WorkoutFeed() {
  const { workouts, total, isLoading, error, refresh } = useWorkoutsFeed()
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/ingest/hevy/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncMessage(
          data.synced > 0
            ? `${data.synced} nieuwe workout${data.synced !== 1 ? 's' : ''} gesynchroniseerd`
            : 'Alles al gesynchroniseerd',
        )
        if (data.synced > 0) {
          await refresh()
        }
      } else {
        setSyncMessage(`Sync mislukt: ${data.error ?? 'onbekende fout'}`)
      }
    } catch {
      setSyncMessage('Sync mislukt — controleer je verbinding')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(null), 4000)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Section header with sync button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-label-secondary uppercase tracking-wide">
          Recente trainingen {total > 0 && <span className="text-label-tertiary font-normal">({total})</span>}
        </h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-xl bg-surface-primary border border-separator px-3 py-1.5 text-xs font-medium text-label-secondary hover:border-separator disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Hevy'}
        </button>
      </div>

      {/* Sync feedback */}
      {syncMessage && (
        <p className="text-xs text-label-tertiary px-1">{syncMessage}</p>
      )}

      {isLoading && <FeedSkeleton />}

      {error && !isLoading && (
        <p className="text-sm text-label-tertiary px-1">Kan trainingen niet laden.</p>
      )}

      {!isLoading && !error && workouts.length === 0 && (
        <EmptyState
          title="Geen trainingen gevonden"
          description="Klik op 'Sync Hevy' om je workouts op te halen."
        />
      )}

      {!isLoading && workouts.length > 0 && (
        <div className="flex flex-col gap-3">
          {workouts.map((workout) => (
            <WorkoutFeedCard key={workout.id} workout={workout} />
          ))}
        </div>
      )}
    </div>
  )
}
