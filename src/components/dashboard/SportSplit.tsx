'use client'

export interface SportSplitProps {
  gymMinutes: number
  runningMinutes: number
  padelMinutes: number
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} u`
  return `${h}u ${m}m`
}

interface SportBarProps {
  label: string
  minutes: number
  maxMinutes: number
  color: string
  sessions: number
}

function SportBar({ label, minutes, maxMinutes, color, sessions }: SportBarProps) {
  const pct = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0">
        <span className="text-sm font-medium text-text-primary">
          {label}
        </span>
        <span className="ml-1 text-xs text-text-tertiary">
          {sessions}x
        </span>
      </div>
      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-sm text-text-tertiary">
        {formatDuration(minutes)}
      </span>
    </div>
  )
}

export function SportSplit({ gymMinutes, runningMinutes, padelMinutes }: SportSplitProps) {
  const maxMinutes = Math.max(gymMinutes, runningMinutes, padelMinutes, 1)

  // Rough session counts: assume ~60 min gym, ~40 min run, ~75 min padel average
  const gymSessions = gymMinutes > 0 ? Math.max(1, Math.round(gymMinutes / 60)) : 0
  const runningSessions = runningMinutes > 0 ? Math.max(1, Math.round(runningMinutes / 40)) : 0
  const padelSessions = padelMinutes > 0 ? Math.max(1, Math.round(padelMinutes / 75)) : 0

  return (
    <div className="flex flex-col gap-3">
      <SportBar
        label="Gym"
        minutes={gymMinutes}
        maxMinutes={maxMinutes}
        color="#2E6F6F"
        sessions={gymSessions}
      />
      <SportBar
        label="Hardlopen"
        minutes={runningMinutes}
        maxMinutes={maxMinutes}
        color="#C2410C"
        sessions={runningSessions}
      />
      <SportBar
        label="Padel"
        minutes={padelMinutes}
        maxMinutes={maxMinutes}
        color="#B45309"
        sessions={padelSessions}
      />
    </div>
  )
}
