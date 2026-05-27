'use client'

import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react'

interface Props {
  data: BlockReviewData
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const w = 80
  const h = 24
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="text-sport-gym" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  )
}

function Bar({ label, value, max, detail }: { label: string; value: number; max: number; detail?: string }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[12px]">
        <span className="text-text-secondary">{label}</span>
        <span className="tabular-nums text-text-primary">{detail ?? value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-sport-gym" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function PerformanceStep({ data, stepIndex, stepTotal, onBack, onNext }: Props) {
  const { totals, templateAdherence, exerciseProgressions, personalRecords } = data
  const muscleTotals = new Map<string, number>()
  for (const week of data.weeklyMuscleVolume ?? []) {
    for (const [muscle, sets] of Object.entries(week.muscles)) {
      muscleTotals.set(muscle, (muscleTotals.get(muscle) ?? 0) + sets)
    }
  }
  const muscleBars = Array.from(muscleTotals.entries())
    .map(([muscle, total]) => ({ muscle, sets: Math.round((total / Math.max(1, data.schema.weeksPlanned)) * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 8)
  const maxMuscleSets = Math.max(1, ...muscleBars.map((m) => m.sets))
  const patternTotals = new Map<string, number>()
  for (const week of data.movementPatternVolume ?? []) {
    for (const [pattern, sets] of Object.entries(week.patterns)) {
      patternTotals.set(pattern, (patternTotals.get(pattern) ?? 0) + sets)
    }
  }
  const push = (patternTotals.get('horizontal_push') ?? 0) + (patternTotals.get('vertical_push') ?? 0)
  const pull = (patternTotals.get('horizontal_pull') ?? 0) + (patternTotals.get('vertical_pull') ?? 0)
  const wellnessEnergy = (data.weeklyWellness ?? []).map((w) => w.avgEnergy).filter((v): v is number => v !== null)
  const wellnessSleep = (data.weeklyWellness ?? []).map((w) => w.avgSleep).filter((v): v is number => v !== null)

  return (
    <StepShell
      title="Prestatie"
      subtitle={`${totals.completedSessions}/${totals.plannedSessions} sessies · ${totals.adherencePct ?? '?'}% adherence`}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
    >
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Per workout</h3>
        <div className="flex flex-col gap-2">
          {templateAdherence.map((t) => (
            <div key={t.focus} className="flex items-center justify-between">
              <span className="text-[14px] text-text-primary">{t.focus}</span>
              <span className="text-[13px] tabular-nums text-text-secondary">
                {t.completed}/{t.planned} · {t.adherencePct ?? '?'}%
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Sport breakdown</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([
            ['Gym', data.sportBreakdown.gym.planned, data.sportBreakdown.gym.actual],
            ['Run', data.sportBreakdown.run.planned, data.sportBreakdown.run.actual],
            ['Padel', data.sportBreakdown.padel.planned, data.sportBreakdown.padel.actual],
          ] as const).map(([label, planned, actual]) => (
            <div key={label} className="rounded-md border border-bg-border p-2">
              <div className="text-[11px] text-text-tertiary">{label}</div>
              <div className="mt-1 text-[16px] font-semibold tabular-nums text-text-primary">{actual}/{planned}</div>
            </div>
          ))}
        </div>
        {(data.sportBreakdown.gym.swaps > 0 || data.sportBreakdown.gym.extras > 0) && (
          <div className="mt-2 text-[12px] text-text-secondary">
            Gym swaps {data.sportBreakdown.gym.swaps} · extra {data.sportBreakdown.gym.extras}
          </div>
        )}
      </section>

      {muscleBars.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
            Spiergroepvolume
          </h3>
          <div className="flex flex-col gap-2">
            {muscleBars.map((m) => (
              <Bar key={m.muscle} label={m.muscle.replaceAll('_', ' ')} value={m.sets} max={maxMuscleSets} detail={`${m.sets} sets/w`} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Balans</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] text-text-secondary">Push / pull</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-text-primary">
              {push}:{pull || 0}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {wellnessEnergy.length > 1 && (
              <div>
                <div className="text-[11px] text-text-tertiary">Energie</div>
                <Sparkline values={wellnessEnergy} />
              </div>
            )}
            {wellnessSleep.length > 1 && (
              <div>
                <div className="text-[11px] text-text-tertiary">Slaap</div>
                <Sparkline values={wellnessSleep} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Oefening-progressie</h3>
        {exerciseProgressions.length === 0 && (
          <div className="text-[13px] text-text-tertiary">Geen oefeningen met genoeg datapoints.</div>
        )}
        <div className="flex flex-col divide-y divide-bg-border/40">
          {exerciseProgressions.map((ex) => {
            const d = ex.deltaE1rmKg ?? 0
            const Icon = d > 0.5 ? TrendingUp : d < -0.5 ? TrendingDown : Minus
            return (
              <div key={ex.exerciseName} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-text-primary truncate">{ex.exerciseName}</span>
                    {ex.stagnant && (
                      <span className="text-[10px] uppercase tracking-wider text-status-warning">stagnant</span>
                    )}
                  </div>
                  <div className="text-[12px] text-text-secondary mt-0.5 tabular-nums">
                    e1RM {ex.startTopE1rm ?? '?'}kg → {ex.endTopE1rm ?? '?'}kg
                    {ex.deltaE1rmKg !== null && (
                      <span className={ex.deltaE1rmKg >= 0 ? 'text-status-success ml-2' : 'text-status-danger ml-2'}>
                        {ex.deltaE1rmKg >= 0 ? '+' : ''}
                        {ex.deltaE1rmKg}kg ({ex.deltaPct ?? '?'}%)
                      </span>
                    )}
                  </div>
                </div>
                <Sparkline values={ex.points.map((p) => p.estimatedOneRm ?? 0)} />
                <Icon size={16} className="text-text-tertiary" />
              </div>
            )
          })}
        </div>
      </section>

      {personalRecords.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3 flex items-center gap-1.5">
            <Trophy size={12} /> PR&apos;s
          </h3>
          <div className="flex flex-col gap-1.5">
            {personalRecords.map((p, i) => (
              <div key={i} className="flex justify-between text-[13px]">
                <span className="text-text-primary truncate">{p.exercise}</span>
                <span className="tabular-nums text-text-secondary">
                  {p.value}
                  {p.unit}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Cardio + totaal</h3>
        <div className="grid grid-cols-2 gap-y-2 text-[13px]">
          <span className="text-text-secondary">Gym sessies</span>
          <span className="tabular-nums text-right text-text-primary">{totals.gymSessions}</span>
          <span className="text-text-secondary">Hardloop</span>
          <span className="tabular-nums text-right text-text-primary">{totals.runs}× / {totals.runKm}km</span>
          <span className="text-text-secondary">Padel</span>
          <span className="tabular-nums text-right text-text-primary">{totals.padelSessions}×</span>
          <span className="text-text-secondary">Totaal tonnage</span>
          <span className="tabular-nums text-right text-text-primary">
            {totals.totalTonnageKg.toLocaleString('nl-NL')} kg
          </span>
        </div>
      </section>
    </StepShell>
  )
}
