'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/v2'
import { useActivityFeed, type ActivityItem } from '@/hooks/useActivityFeed'
import { sportMeta, type SportKey } from '@/lib/sports/registry'
import { sportMetric } from '@/lib/sports/metric'

const MAX_ITEMS = 5

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  if (diffDays < 7) return ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()]
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

/** Kerngetal per sport — gedelegeerd aan de sport-registry. */
function metric(activity: ActivityItem): string | null {
  return sportMetric(activity.type as SportKey, {
    totalVolumeKg: activity.total_volume_kg,
    distanceMeters: activity.distance_meters,
    avgPaceSecondsPerKm: activity.avg_pace_seconds_per_km,
    durationSeconds: activity.duration_seconds,
    avgHeartRate: activity.avg_heart_rate,
  })
}

/** Detailpagina, of null als die niet bestaat (padel/walk/overige). */
function activityHref(activity: ActivityItem): string | null {
  if (activity.type === 'gym') return `/workouts/${activity.id}`
  if (activity.type === 'run') return `/runs/${activity.id}`
  return null
}

// ── Row ──────────────────────────────────────────────────────────────────────

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const meta = sportMeta(activity.type as SportKey)
  const Icon = meta.icon
  const value = metric(activity)
  const href = activityHref(activity)

  const inner = (
    <div className="flex min-h-[44px] items-center gap-3 px-[14px] py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: meta.colorLight }}
      >
        <Icon size={15} strokeWidth={2.2} color={meta.colorBase} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-text-primary">
          {activity.title}
        </div>
        <div className="text-[12px] text-text-tertiary">
          {formatDate(activity.started_at)}
          {value ? ` · ${value}` : ''}
        </div>
      </div>
      {href && <ChevronRight size={16} className="shrink-0 text-text-tertiary" />}
    </div>
  )

  if (!href) {
    return <div className="border-b border-bg-border last:border-0">{inner}</div>
  }
  return (
    <Link
      href={href}
      aria-label={`Bekijk ${activity.title}`}
      className="block border-b border-bg-border transition-colors last:border-0 hover:bg-white/[0.02] active:scale-[0.99]"
    >
      {inner}
    </Link>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RecentActivities() {
  const { activities, isLoading, error } = useActivityFeed()

  if (error) return null

  if (isLoading) {
    return (
      <Card>
        <div className="px-[14px] pb-2 pt-[14px]">
          <div className="h-3 w-32 rounded bg-white/[0.06]" />
        </div>
        <div className="animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[44px] items-center gap-3 border-b border-bg-border px-[14px] py-2.5 last:border-0"
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
                <div className="h-2.5 w-1/3 rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (activities.length === 0) return null

  const recent = activities.slice(0, MAX_ITEMS)

  return (
    <Card>
      <div className="px-[14px] pb-2 pt-[14px]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">
          Recente activiteiten
        </div>
      </div>
      <div>
        {recent.map((activity) => (
          <ActivityRow key={`${activity.type}-${activity.id}`} activity={activity} />
        ))}
      </div>
    </Card>
  )
}
