'use client'

import type { WorkoutCardData } from '@/lib/ai/chat/cards'

const SPORT_STYLES: Record<string, string> = {
  gym:   'text-[#00E5C7] bg-[#00E5C7]/[0.08] border-[#00E5C7]/[0.3]',
  run:   'text-[#FF5E3A] bg-[#FF5E3A]/[0.08] border-[#FF5E3A]/[0.3]',
  padel: 'text-[#FFB020] bg-[#FFB020]/[0.08] border-[#FFB020]/[0.3]',
  cycle: 'text-[#9CFF4F] bg-[#9CFF4F]/[0.08] border-[#9CFF4F]/[0.3]',
}
const SPORT_LABELS: Record<string, string> = {
  gym: 'Gym', run: 'Run', padel: 'Padel', cycle: 'Fiets',
}

export interface WorkoutCardProps { data: WorkoutCardData }

export function WorkoutCard({ data }: WorkoutCardProps) {
  const sportStyle =
    SPORT_STYLES[data.sport] ?? 'text-text-secondary bg-white/[0.06] border-white/[0.1]'
  return (
    <div className="mt-2 rounded-[13px] border-[0.5px] border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
      {/* Header: sport badge · title · optional duration · optional RPE */}
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 rounded-full border-[0.5px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.4px] ${sportStyle}`}
        >
          {SPORT_LABELS[data.sport] ?? data.sport}
        </span>
        <span className="flex-1 truncate text-body font-semibold text-text-primary">{data.title}</span>
        {data.duration_min != null && (
          <span className="shrink-0 text-caption1 text-text-tertiary">{data.duration_min} min</span>
        )}
        {data.rpe != null && (
          <span className="shrink-0 text-caption1 text-text-tertiary">RPE {data.rpe}</span>
        )}
      </div>
      <p className="mt-0.5 text-caption1 text-text-tertiary">{data.date}</p>
      {/* Exercise rows: name · sets × reps · @ weight_kg kg */}
      {data.exercises && data.exercises.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.exercises.map((ex, i) => (
            <div key={i} className="flex items-baseline gap-2 text-caption1">
              <span className="flex-1 truncate text-text-secondary">{ex.name}</span>
              {ex.sets != null && ex.reps != null && (
                <span className="shrink-0 text-text-tertiary">{ex.sets} × {ex.reps}</span>
              )}
              {ex.weight_kg != null && (
                <span className="shrink-0 text-text-tertiary">@ {ex.weight_kg}kg</span>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Highlights */}
      {data.highlights && data.highlights.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {data.highlights.map((h, i) => (
            <li key={i} className="flex items-center gap-1.5 text-caption1 text-text-secondary">
              <span className="h-1 w-1 shrink-0 rounded-full bg-text-tertiary" aria-hidden="true" />
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
