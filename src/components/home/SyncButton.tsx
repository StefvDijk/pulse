'use client'

import { useState } from 'react'
import { RefreshCw, Check, AlertCircle, Info } from 'lucide-react'
import { todayAmsterdam, weekStartAmsterdam } from '@/lib/time/amsterdam'

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export function SyncButton() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  async function handleSync() {
    setStatus('syncing')
    setMessage(null)

    try {
      const hevyRes = await fetch('/api/ingest/hevy/sync', { method: 'POST' })
      const hevyData = hevyRes.ok ? await hevyRes.json() : null

      const todayStr = todayAmsterdam()
      const mondayStr = weekStartAmsterdam()

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

      if (hevyData?.synced > 0) {
        const noun = hevyData.synced === 1 ? 'workout' : 'workouts'
        setMessage(`${hevyData.synced} nieuwe ${noun}`)
      } else {
        setMessage('Hevy is up-to-date')
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
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
          {status === 'syncing' ? 'Hevy synchroniseren...' : 'Hevy synchroniseren'}
        </button>

        <div className="flex items-center gap-2">
          {message && (
            <span className={`text-caption1 ${status === 'error' ? 'text-system-red' : 'text-label-tertiary'}`}>
              {message}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Hoe werkt syncen?"
            className="flex h-6 w-6 items-center justify-center rounded-full text-label-tertiary hover:bg-system-gray6 transition-colors"
          >
            <Info size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="rounded-xl bg-system-gray6 p-3 text-caption1 leading-relaxed text-label-secondary">
          <p className="mb-1.5">
            <strong className="text-label-primary">Hevy</strong>: deze knop trekt jouw nieuwste workouts op.
            Hevy synct automatisch elke ochtend; gebruik deze knop alleen als je net iets hebt afgerond.
          </p>
          <p>
            <strong className="text-label-primary">Apple Health</strong>: pusht zichzelf vanuit de
            Health Auto Export-app op je iPhone (typisch dagelijks). Open die app als je
            de data van vandaag eerder wilt zien — Pulse kan HAE niet zelf aansporen.
          </p>
        </div>
      )}
    </div>
  )
}
