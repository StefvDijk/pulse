'use client'

import { Footprints, Heart, Activity, Moon, Scale, AlertCircle } from 'lucide-react'
import { useTodayHealth } from '@/hooks/useTodayHealth'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'
import { Card } from '@/components/ui'
import { formatShortDate, formatTime } from '@/lib/time/amsterdam'

function formatSteps(n: number): string {
  return n.toLocaleString('nl-NL')
}

function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}

function formatWeight(kg: number): string {
  return `${kg.toFixed(1).replace('.', ',')} kg`
}

interface StatProps {
  icon: React.ReactNode
  label: string
  value: string | null
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="text-label-tertiary">{icon}</div>
      <p className="text-subhead font-semibold tabular-nums text-label-primary">
        {value ?? '—'}
      </p>
      <p className="text-caption2 text-label-tertiary">{label}</p>
    </div>
  )
}

function lastSyncedLabel(lastSyncedAt: string | null): string | null {
  if (!lastSyncedAt) return null
  const d = new Date(lastSyncedAt)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  const sameDay = formatShortDate(today) === formatShortDate(d)
  return sameDay
    ? `Laatst gesynced om ${formatTime(d)}`
    : `Laatst gesynced ${formatShortDate(d)} ${formatTime(d)}`
}

export function DailyHealthBar() {
  const { health, isLoading } = useTodayHealth()

  if (isLoading) {
    return (
      <SkeletonCard className="flex items-center justify-around gap-2 py-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <SkeletonLine width="w-8" height="h-4" />
            <SkeletonLine width="w-10" height="h-2.5" />
          </div>
        ))}
      </SkeletonCard>
    )
  }

  if (!health) return null

  const headerLabel = `Vandaag, ${formatShortDate(`${health.today}T12:00:00Z`)}`
  const data = health.data
  const syncLabel = lastSyncedLabel(health.lastSyncedAt)

  // Geen data ooit — toon alleen kop + leeg signaal.
  const hasNoDataAtAll = !data && !health.weight

  if (hasNoDataAtAll) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-caption2 text-label-tertiary uppercase tracking-wider px-1">
          {headerLabel}
        </p>
        <Card padding="md">
          <div className="flex items-center gap-2 text-caption1 text-label-tertiary">
            <AlertCircle size={14} strokeWidth={1.5} />
            <span>Nog geen Apple Health-data gesynced.</span>
          </div>
        </Card>
      </div>
    )
  }

  // Data aanwezig (mogelijk stale).
  const staleNote =
    data && health.isStale
      ? `Data van ${formatShortDate(`${data.date}T12:00:00Z`)} — vandaag nog niet gesynced`
      : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-caption2 text-label-tertiary uppercase tracking-wider">
          {headerLabel}
        </p>
        {syncLabel && (
          <span className="text-caption2 text-label-tertiary opacity-70">
            {syncLabel}
          </span>
        )}
      </div>

      {staleNote && (
        <div className="flex items-center gap-1.5 px-1 text-caption2 text-system-orange">
          <AlertCircle size={11} strokeWidth={2} />
          <span>{staleNote}</span>
        </div>
      )}

      {data && (
        <Card padding="none">
          <div className="grid grid-cols-4 divide-x divide-separator">
            <Stat
              icon={<Footprints size={14} strokeWidth={1.5} />}
              label="Stappen"
              value={data.steps != null ? formatSteps(data.steps) : null}
            />
            <Stat
              icon={<Heart size={14} strokeWidth={1.5} />}
              label="Rust HR"
              value={data.resting_heart_rate != null ? `${data.resting_heart_rate}` : null}
            />
            <Stat
              icon={<Activity size={14} strokeWidth={1.5} />}
              label="HRV"
              value={data.hrv_average != null ? `${Math.round(data.hrv_average)}` : null}
            />
            <Stat
              icon={<Moon size={14} strokeWidth={1.5} />}
              label="Slaap"
              value={data.sleep_minutes != null ? formatSleep(data.sleep_minutes) : null}
            />
          </div>
        </Card>
      )}

      {health.weight && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-caption1 text-label-tertiary">
          <Scale size={12} strokeWidth={1.5} />
          <span>{formatWeight(health.weight.kg)}</span>
          {health.weight.date !== health.today && (
            <span className="text-label-tertiary opacity-60">
              ({formatShortDate(`${health.weight.date}T12:00:00Z`)})
            </span>
          )}
        </div>
      )}
    </div>
  )
}
