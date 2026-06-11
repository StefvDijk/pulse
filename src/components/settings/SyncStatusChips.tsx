'use client'

import useSWR from 'swr'
import type { SyncStatusResponse, SyncStatusEntry } from '@/app/api/sync-status/route'

// Compact per-source "last synced" lines for the Settings Synchronisatie
// section. Makes it visible at a glance when each bron last synced and whether
// the last attempt failed — previously there was no such surface anywhere.

const SOURCE_LABELS: Record<SyncStatusEntry['source'], string> = {
  hevy: 'Hevy',
  apple_health: 'Apple Health',
  strava: 'Strava',
}

// Sources we always show a row for, even when never synced.
const ALL_SOURCES: SyncStatusEntry['source'][] = ['hevy', 'apple_health', 'strava']

const fetcher = async (url: string): Promise<SyncStatusResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Kon sync-status niet laden')
  return res.json() as Promise<SyncStatusResponse>
}

function formatRelative(startedAt: string): string {
  const then = new Date(startedAt)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  const time = then.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

  if (diffDays <= 0 && then.getDate() === now.getDate()) {
    return `vandaag ${time}`
  }
  if (diffDays <= 1) {
    return 'gisteren'
  }
  if (diffDays < 7) {
    return `${diffDays} dagen geleden`
  }
  return then.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

interface RowProps {
  source: SyncStatusEntry['source']
  entry: SyncStatusEntry | undefined
}

function StatusRow({ source, entry }: RowProps) {
  const label = SOURCE_LABELS[source]

  if (!entry) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-tertiary">— nog nooit</span>
      </div>
    )
  }

  const isError = entry.status === 'error'
  const icon = isError ? '⚠' : '✓'
  const color = isError ? 'text-status-bad' : 'text-status-good'

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-secondary">{label}</span>
      <span className={color}>
        {icon} {formatRelative(entry.startedAt)}
      </span>
    </div>
  )
}

export function SyncStatusChips() {
  const { data, error } = useSWR<SyncStatusResponse>('/api/sync-status', fetcher, {
    refreshInterval: 60000,
  })

  if (error) return null

  const bySource = new Map<SyncStatusEntry['source'], SyncStatusEntry>(
    (data?.sources ?? []).map((s) => [s.source, s]),
  )

  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-bg-border pt-3">
      {ALL_SOURCES.map((source) => (
        <StatusRow key={source} source={source} entry={bySource.get(source)} />
      ))}
    </div>
  )
}
