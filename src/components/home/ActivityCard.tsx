'use client'

import Link from 'next/link'
import { Dumbbell, Footprints, Trophy, Clock, Flame, Heart, MapPin, Gauge } from 'lucide-react'
import { MuscleGroupDot } from './MuscleGroupDot'
import type { ActivityItem } from '@/hooks/useActivityFeed'

/* ── Helpers ─────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}u ${rem}m` : `${h}u`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  if (diffDays < 7) {
    return ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()]
  }
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function formatPace(secondsPerKm: number): string {
  const min = Math.floor(secondsPerKm / 60)
  const sec = Math.round(secondsPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}

function formatDistance(meters: number): string {
  const km = meters / 1000
  return `${km.toFixed(1).replace('.', ',')} km`
}

function formatVolume(kg: number): string {
  return `${Math.round(kg).toLocaleString('nl-NL')} kg`
}

/* ── Sport config ────────────────────────────────────────── */

const SPORT_CONFIG = {
  gym: {
    icon: Dumbbell,
    color: 'text-[#0A84FF]',
    bg: 'bg-[#0A84FF]/10',
    border: 'border-[#0A84FF]/20',
  },
  run: {
    icon: Footprints,
    color: 'text-[var(--color-status-warn)]',
    bg: 'bg-[var(--color-status-warn)]/10',
    border: 'border-[var(--color-status-warn)]/20',
  },
  padel: {
    icon: Gauge,
    color: 'text-[var(--color-status-warn)]',
    bg: 'bg-[var(--color-status-warn)]/10',
    border: 'border-system-yellow/20',
  },
} as const

/* ── Component ───────────────────────────────────────────── */

export function ActivityCard({ activity }: { activity: ActivityItem }) {
  const config = SPORT_CONFIG[activity.type]
  const Icon = config.icon
  const hasPRs = activity.type === 'gym' && (activity.pr_count ?? 0) > 0

  const card = (
    <div className={`rounded-2xl bg-bg-surface border ${config.border} border-bg-border p-4 transition-colors hover:border-bg-border`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
            <Icon size={16} className={config.color} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary truncate">
                {activity.title}
              </h3>
              {hasPRs && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  <Trophy size={9} />
                  {activity.pr_count}
                </span>
              )}
            </div>
            <p className="text-xs text-text-tertiary">
              {formatDate(activity.started_at)} · {formatTime(activity.started_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        {activity.duration_seconds != null && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <Clock size={11} className="text-text-tertiary" />
            {formatDuration(activity.duration_seconds)}
          </span>
        )}

        {/* Run-specific stats */}
        {activity.type === 'run' && activity.distance_meters != null && (
          <span className={`flex items-center gap-1 text-xs font-medium ${config.color}`}>
            <MapPin size={11} />
            {formatDistance(activity.distance_meters)}
          </span>
        )}
        {activity.type === 'run' && activity.avg_pace_seconds_per_km != null && (
          <span className="text-xs tabular-nums text-text-secondary">
            {formatPace(activity.avg_pace_seconds_per_km)}
          </span>
        )}

        {/* Gym-specific stats */}
        {activity.type === 'gym' && activity.total_volume_kg != null && activity.total_volume_kg > 0 && (
          <span className="text-xs text-text-secondary font-medium tabular-nums">
            {formatVolume(activity.total_volume_kg)}
          </span>
        )}

        {/* Shared stats */}
        {activity.calories_burned != null && activity.calories_burned > 0 && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <Flame size={11} className="text-orange-400" />
            {Math.round(activity.calories_burned)} kcal
          </span>
        )}
        {activity.avg_heart_rate != null && (
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <Heart size={11} className="text-red-400" />
            {activity.avg_heart_rate} bpm
          </span>
        )}
      </div>

      {/* Gym exercise list */}
      {activity.type === 'gym' && activity.exercises && activity.exercises.length > 0 && (
        <div className="mt-3 flex flex-col divide-y divide-separator">
          {activity.exercises.slice(0, 4).map((exercise, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <MuscleGroupDot muscleGroup={exercise.primary_muscle_group} size="sm" />
              <div className="flex flex-1 items-center justify-between min-w-0 gap-2">
                <span className="text-sm text-text-primary truncate">{exercise.name}</span>
                {exercise.set_summary && (
                  <span className="text-xs tabular-nums text-text-tertiary shrink-0">
                    {exercise.set_summary}
                  </span>
                )}
              </div>
            </div>
          ))}
          {activity.exercises.length > 4 && (
            <p className="pt-2 text-xs text-text-tertiary">
              +{activity.exercises.length - 4} oefeningen meer
            </p>
          )}
        </div>
      )}
    </div>
  )

  // Only gym workouts are clickable (have detail page)
  if (activity.type === 'gym') {
    return <Link href={`/workouts/${activity.id}`} className="block active:scale-[0.99]">{card}</Link>
  }

  return card
}
