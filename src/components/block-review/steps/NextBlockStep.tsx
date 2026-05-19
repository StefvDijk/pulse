'use client'

import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, NextBlockGoalDraft } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  onGoalsChange: (next: NextBlockGoalDraft[]) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

interface ProposalShape {
  title: string
  schema_type: string
  weeks_planned: number
  start_date: string
  workout_schedule: Array<{
    day: string
    focus: string
    duration_min?: number
    exercises?: Array<{ name: string; sets?: number; reps?: string }>
  }>
}

function isValidProposal(p: unknown): p is ProposalShape {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  if (typeof o.title !== 'string' || typeof o.schema_type !== 'string') return false
  if (typeof o.start_date !== 'string' || typeof o.weeks_planned !== 'number') return false
  if (!Array.isArray(o.workout_schedule) || o.workout_schedule.length === 0) return false
  return o.workout_schedule.every((w) => {
    if (!w || typeof w !== 'object') return false
    const wo = w as Record<string, unknown>
    return typeof wo.day === 'string' && typeof wo.focus === 'string'
  })
}

export function NextBlockStep({ data, form, onGoalsChange, stepIndex, stepTotal, onBack, onNext }: Props) {
  const proposal = form.aiSchemaProposal as ProposalShape | null
  const proposalValid = isValidProposal(proposal)

  function toggleGoal(g: BlockReviewData['goals'][number]) {
    const exists = form.selectedGoals.find((x) => x.id === g.id)
    if (exists) {
      onGoalsChange(form.selectedGoals.filter((x) => x.id !== g.id))
    } else {
      onGoalsChange([
        ...form.selectedGoals,
        {
          id: g.id,
          title: g.title,
          category: g.category,
          targetValue: g.targetValue ?? undefined,
          targetUnit: g.targetUnit ?? undefined,
          deadline: g.deadline ?? undefined,
          isNew: false,
        },
      ])
    }
  }

  return (
    <StepShell
      title="Volgend blok"
      subtitle="Bevestig doelen en bekijk het AI-voorstel"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!!proposal && !proposalValid}
    >
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Doelen voor volgend blok
        </h3>
        {data.goals.length === 0 && (
          <div className="text-[13px] text-text-tertiary">Geen actieve doelen. Voeg er een toe via /goals.</div>
        )}
        <div className="flex flex-col gap-2">
          {data.goals.map((g) => {
            const selected = !!form.selectedGoals.find((x) => x.id === g.id)
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGoal(g)}
                className={`text-left rounded-md border p-3 ${
                  selected ? 'border-text-primary bg-white/5' : 'border-bg-border'
                }`}
              >
                <div className="text-[14px] text-text-primary">{g.title}</div>
                <div className="text-[12px] text-text-secondary tabular-nums">
                  {g.currentValue ?? '?'} → {g.targetValue ?? '?'}
                  {g.targetUnit ? ` ${g.targetUnit}` : ''}
                  {g.deadline ? ` · ${g.deadline}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Schema-voorstel
        </h3>
        {proposal != null && !proposalValid && (
          <div className="mb-3 text-[13px] text-status-warning">
            AI-voorstel is niet geldig — ga terug en herlaad de analyse, of bevestig zonder nieuw schema.
          </div>
        )}
        {!proposal ? (
          <div className="text-[13px] text-status-warning">
            Geen schema-voorstel ontvangen — je kunt later via de coach een schema vragen.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[15px] font-semibold text-text-primary">{proposal.title}</div>
              <div className="text-[12px] text-text-secondary">
                {proposal.weeks_planned} weken · start {proposal.start_date}
              </div>
            </div>
            <div className="flex flex-col divide-y divide-bg-border/40">
              {proposal.workout_schedule.map((w) => (
                <div key={w.day} className="py-2.5">
                  <div className="flex justify-between">
                    <span className="text-[14px] text-text-primary capitalize">
                      {w.day} · {w.focus}
                    </span>
                    <span className="text-[12px] text-text-tertiary">{w.duration_min ?? 55} min</span>
                  </div>
                  {w.exercises && (
                    <ul className="mt-1.5 ml-1 text-[12px] text-text-secondary list-disc list-inside">
                      {w.exercises.map((e, i) => (
                        <li key={i}>
                          {e.name} {e.sets ? `· ${e.sets}×${e.reps ?? ''}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </StepShell>
  )
}
