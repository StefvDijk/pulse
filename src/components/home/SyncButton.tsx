'use client'

import { useState } from 'react'
import { RefreshCw, Check, AlertCircle } from 'lucide-react'

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface SyncResult {
  hevy: { synced: number } | null
  aggregate: boolean
  error?: string
}

export function SyncButton() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleSync() {
    setStatus('syncing')
    setMessage(null)

    try {
      // Step 1: Sync workouts from Hevy
      const hevyRes = await fetch('/api/ingest/hevy/sync', { method: 'POST' })
      const hevyData = hevyRes.ok ? await hevyRes.json() : null

      // Step 2: Recompute aggregations (daily + weekly) with fresh data
      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

      // Compute current week's Monday in Amsterdam timezone
      const now = new Date()
      const amsterdamDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Amsterdam' }).format(now)
      const daysFromMonday: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
      const offset = daysFromMonday[amsterdamDay] ?? 0
      const mondayMs = now.getTime() - offset * 86_400_000
      const mondayStr = new Date(mondayMs).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

      const [dailyRes, weeklyRes] = await Promise.all([
        fetch('/api/aggregations/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'daily', date: todayStr }),
        }),
        fetch('/api/aggregations/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'weekly', week_start: mondayStr }),
        }),
      ])

      const aggOk = dailyRes.ok && weeklyRes.ok

      const parts: string[] = []

      if (hevyData?.synced > 0) {
        parts.push(`${hevyData.synced} nieuwe workout${hevyData.synced !== 1 ? 's' : ''}`)
      }

      if (parts.length > 0) {
        setMessage(parts.join(', '))
      } else {
        setMessage('Alles up-to-date')
      }

      if (!aggOk) {
        setMessage((prev) => (prev ? `${prev} (aggregatie mislukt)` : 'Aggregatie mislukt'))
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setMessage('Sync mislukt')
    }

    setTimeout(() => {
      setStatus('idle')
      setMessage(null)
    }, 4000)
  }

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={handleSync}
        disabled={status === 'syncing'}
        className="flex items-center gap-1.5 rounded-full bg-system-blue/10 px-4 py-2 text-caption1 font-semibold text-system-blue hover:bg-system-blue/15 active:scale-[0.98] disabled:opacity-50 transition-all duration-150"
      >
        {status === 'syncing' ? (
          <RefreshCw size={12} strokeWidth={2} className="animate-spin" />
        ) : status === 'success' ? (
          <Check size={12} strokeWidth={2} className="text-system-green" />
        ) : status === 'error' ? (
          <AlertCircle size={12} strokeWidth={2} className="text-system-red" />
        ) : (
          <RefreshCw size={12} strokeWidth={2} />
        )}
        {status === 'syncing' ? 'Synchroniseren...' : 'Data synchroniseren'}
      </button>

      {message && (
        <span className={`text-caption1 ${status === 'error' ? 'text-system-red' : 'text-text-tertiary'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
