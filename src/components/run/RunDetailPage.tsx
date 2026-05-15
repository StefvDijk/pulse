'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { NavBar } from '@/components/ui/NavBar'
import { Card } from '@/components/ui/v2'
import { RouteMap } from '@/components/maps/RouteMap'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
import { useRunDetail } from '@/hooks/useRunDetail'

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '—'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}/km`
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}u ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function formatDistance(meters: number): { value: string; unit: string } {
  if (meters >= 1000) return { value: (meters / 1000).toFixed(2), unit: 'km' }
  return { value: Math.round(meters).toString(), unit: 'm' }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  }).format(new Date(iso))
}

interface RunDetailPageProps {
  runId: string
}

export function RunDetailPage({ runId }: RunDetailPageProps) {
  const router = useRouter()
  const { run, error, isLoading } = useRunDetail(runId)

  const backButton = (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-0.5 text-[#0A84FF] active:opacity-60 transition-opacity"
      aria-label="Terug"
    >
      <ChevronLeft size={20} strokeWidth={2.5} />
      <span className="text-[17px] tracking-[-0.2px]">Terug</span>
    </button>
  )

  if (isLoading) {
    return (
      <>
        <NavBar variant="inline" leading={backButton} />
        <div className="flex flex-col gap-4 px-4 pb-24 pt-4">
          <SkeletonRect height="h-56" />
          <SkeletonCard className="flex flex-col gap-2">
            <SkeletonLine width="w-1/2" />
            <SkeletonLine width="w-1/3" height="h-3" />
          </SkeletonCard>
        </div>
      </>
    )
  }

  if (error || !run) {
    return (
      <>
        <NavBar variant="inline" leading={backButton} />
        <div className="px-4 pt-4">
          <p className="text-[14px] text-text-tertiary">Run niet gevonden.</p>
        </div>
      </>
    )
  }

  const distance = formatDistance(run.distance_meters)
  const title = run.strava_name ?? run.run_type ?? 'Hardlopen'

  const stats: Array<{ label: string; value: string; unit: string }> = [
    { label: 'Afstand', value: distance.value, unit: distance.unit },
    { label: 'Duur', value: formatDuration(run.duration_seconds), unit: '' },
    { label: 'Tempo', value: formatPace(run.avg_pace_seconds_per_km), unit: '' },
  ]
  if (run.elevation_gain_meters != null) {
    stats.push({ label: 'Hoogte', value: Math.round(run.elevation_gain_meters).toString(), unit: 'm' })
  }
  if (run.avg_heart_rate != null) {
    stats.push({ label: 'Avg HR', value: Math.round(run.avg_heart_rate).toString(), unit: 'bpm' })
  }
  if (run.max_heart_rate != null) {
    stats.push({ label: 'Max HR', value: Math.round(run.max_heart_rate).toString(), unit: 'bpm' })
  }

  return (
    <>
      <NavBar variant="inline" leading={backButton} />

      <div className="flex flex-col gap-3 pb-24">
        {/* Map hero — Strava-pattern */}
        <div className="px-4 pt-2">
          <RouteMap polyline={run.polyline} className="h-64 w-full rounded-card-lg overflow-hidden" />
        </div>

        {/* Title + date */}
        <div className="px-4">
          <h1 className="text-[24px] font-bold tracking-[-0.4px] text-text-primary">
            {title}
          </h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">{formatDate(run.started_at)}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.4px] text-text-tertiary">
            <span>{run.source}</span>
            {run.strava_activity_id && (
              <a
                href={`https://www.strava.com/activities/${run.strava_activity_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#FC4C02] hover:underline"
              >
                Op Strava ↗
              </a>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="px-4">
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-y-4 gap-x-3">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-text-tertiary">
                    {s.label}
                  </div>
                  <div className="mt-1 text-[20px] font-bold tracking-[-0.3px] text-text-primary tabular-nums">
                    {s.value}
                    {s.unit && (
                      <span className="ml-1 text-[12px] font-medium text-text-secondary">
                        {s.unit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {run.notes && (
          <div className="px-4">
            <Card className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-text-tertiary">
                Notities
              </div>
              <div className="mt-1.5 text-[13px] leading-snug text-text-secondary">
                {run.notes}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
