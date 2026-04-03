'use client'

import { Dumbbell, Activity } from 'lucide-react'

interface CompactStatsProps {
  gymSessions?: number
  runningSessions?: number
  padelSessions?: number
  totalMinutes?: number
  totalTonnage?: number
  acwr?: number | null
  workloadStatus?: string | null
}

const WORKLOAD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Laag', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  optimal: { label: 'Optimaal', color: 'text-status-green', bg: 'bg-status-green/10' },
  high: { label: 'Hoog', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  overreaching: { label: 'Te hoog', color: 'text-status-red', bg: 'bg-status-red/10' },
}

export function CompactStats({
  gymSessions = 0,
  runningSessions = 0,
  padelSessions = 0,
  totalMinutes,
  totalTonnage,
  acwr,
  workloadStatus,
}: CompactStatsProps) {
  const totalSessions = gymSessions + runningSessions + padelSessions
  const wl = workloadStatus ? WORKLOAD_CONFIG[workloadStatus] : null

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {/* Sessions with sport breakdown */}
        <div className="rounded-2xl bg-bg-card border border-border-light p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-text-primary">
            {totalSessions}
          </p>
          <p className="text-xs text-text-tertiary">
            {totalSessions === 1 ? 'sessie' : 'sessies'}
          </p>
          {totalSessions > 0 && (
            <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-text-tertiary">
              {gymSessions > 0 && <span>{gymSessions}× gym</span>}
              {runningSessions > 0 && <span>{runningSessions}× run</span>}
              {padelSessions > 0 && <span>{padelSessions}× padel</span>}
            </div>
          )}
        </div>

        {/* Training time */}
        <div className="rounded-2xl bg-bg-card border border-border-light p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-text-primary">
            {totalMinutes ? `${Math.round(totalMinutes)}` : '0'}
          </p>
          <p className="text-xs text-text-tertiary">minuten</p>
        </div>

        {/* Tonnage */}
        <div className="rounded-2xl bg-bg-card border border-border-light p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-text-primary">
            {totalTonnage != null && totalTonnage > 0
              ? Math.round(totalTonnage).toLocaleString('nl-NL')
              : '—'}
          </p>
          <p className="text-xs text-text-tertiary">kg volume</p>
        </div>
      </div>

      {/* ACWR / Workload status */}
      {wl && acwr != null && (
        <div className={`flex items-center justify-between rounded-2xl border border-border-light px-4 py-3 ${wl.bg}`}>
          <div className="flex items-center gap-2">
            <Activity size={14} className={wl.color} />
            <span className="text-sm font-medium text-text-primary">Belasting</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${wl.color}`}>
              {wl.label}
            </span>
            <span className="text-xs tabular-nums text-text-tertiary">
              ACWR {acwr.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
