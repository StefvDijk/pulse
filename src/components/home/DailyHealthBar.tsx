'use client'

import { Footprints, Heart, Activity, Moon, Scale } from 'lucide-react'
import { useTodayHealth } from '@/hooks/useTodayHealth'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'

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
      <div className="text-text-tertiary">{icon}</div>
      <p className="text-sm font-bold tabular-nums text-text-primary">
        {value ?? '—'}
      </p>
      <p className="text-[10px] text-text-tertiary">{label}</p>
    </div>
  )
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

  // Don't render anything if there's no health data at all
  const hasAnyData = health && (
    health.steps != null ||
    health.resting_heart_rate != null ||
    health.hrv_average != null ||
    health.sleep_minutes != null ||
    health.weight_kg != null
  )

  if (!hasAnyData) return null

  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = health?.date === todayStr
  const dateLabel = isToday
    ? 'Vandaag'
    : health?.date
      ? new Date(health.date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })
      : ''

  return (
    <div className="flex flex-col gap-2">
      {!isToday && dateLabel && (
        <p className="text-[10px] text-text-tertiary uppercase tracking-wide px-1">
          {dateLabel}
        </p>
      )}
      <div className="rounded-2xl bg-bg-card border border-border-light">
        <div className="grid grid-cols-4 divide-x divide-border-light">
          <Stat
            icon={<Footprints size={14} />}
            label="Stappen"
            value={health?.steps != null ? formatSteps(health.steps) : null}
          />
          <Stat
            icon={<Heart size={14} />}
            label="Rust HR"
            value={health?.resting_heart_rate != null ? `${health.resting_heart_rate}` : null}
          />
          <Stat
            icon={<Activity size={14} />}
            label="HRV"
            value={health?.hrv_average != null ? `${Math.round(health.hrv_average)}` : null}
          />
          <Stat
            icon={<Moon size={14} />}
            label="Slaap"
            value={health?.sleep_minutes != null ? formatSleep(health.sleep_minutes) : null}
          />
        </div>
      </div>

      {/* Weight — separate compact line */}
      {health?.weight_kg != null && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-tertiary">
          <Scale size={12} />
          <span>{formatWeight(health.weight_kg)}</span>
          {health.weight_date && health.weight_date !== health.date && (
            <span className="text-text-muted">
              ({new Date(health.weight_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })})
            </span>
          )}
        </div>
      )}
    </div>
  )
}
