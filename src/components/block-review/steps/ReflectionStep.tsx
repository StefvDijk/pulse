'use client'

import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { ReflectionState, TemplateRating } from '../types'

interface Props {
  data: BlockReviewData
  value: ReflectionState
  onChange: (next: ReflectionState) => void
  endReason: 'completed' | 'switched' | 'injury' | 'goal_reached' | 'time_up'
  onEndReasonChange: (next: 'completed' | 'switched' | 'injury' | 'goal_reached' | 'time_up') => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

const RATINGS: NonNullable<TemplateRating['rating']>[] = ['good', 'ok', 'meh']
const RATING_LABEL: Record<NonNullable<TemplateRating['rating']>, string> = {
  good: '🙂 Fijn',
  ok: '😐 Oké',
  meh: '😕 Minder',
}

export function ReflectionStep({ data, value, onChange, endReason, onEndReasonChange, stepIndex, stepTotal, onBack, onNext }: Props) {
  const exerciseNames = data.exerciseProgressions.map((e) => e.exerciseName)

  function setTemplateRating(idx: number, partial: Partial<TemplateRating>) {
    const next = value.templateRatings.map((t, i) => (i === idx ? { ...t, ...partial } : t))
    onChange({ ...value, templateRatings: next })
  }

  function toggleExercise(list: string[], name: string): string[] {
    return list.includes(name) ? list.filter((x) => x !== name) : [...list, name]
  }

  function setInjuryUpdate(loc: string, status: 'still_active' | 'resolved') {
    onChange({ ...value, injuryUpdates: { ...value.injuryUpdates, [loc]: status } })
  }

  const ratedCount = value.templateRatings.filter((t) => t.rating !== null).length
  const canNext = ratedCount === value.templateRatings.length

  return (
    <StepShell
      title="Reflectie"
      subtitle="Hoe voelde dit blok?"
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!canNext}
    >
      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Hoe sluit je dit blok af?</h3>
        <div className="flex flex-wrap gap-1.5">
          {([
            ['completed', 'Voltooid'],
            ['switched', 'Switch'],
            ['injury', 'Blessure'],
            ['goal_reached', 'Doel gehaald'],
            ['time_up', 'Tijd op'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onEndReasonChange(value)}
              className={`px-3 py-1.5 rounded-full border text-[12px] ${
                endReason === value ? 'border-text-primary text-text-primary' : 'border-bg-border text-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Per workout</h3>
        {value.templateRatings.map((t, idx) => (
          <div key={t.focus} className="flex flex-col gap-2">
            <span className="text-[14px] text-text-primary">{t.focus}</span>
            <div className="flex gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTemplateRating(idx, { rating: r })}
                  className={`px-3 py-1.5 rounded-full border text-[13px] ${
                    t.rating === r ? 'border-text-primary text-text-primary' : 'border-bg-border text-text-secondary'
                  }`}
                >
                  {RATING_LABEL[r]}
                </button>
              ))}
            </div>
            <input
              value={t.note}
              onChange={(e) => setTemplateRating(idx, { note: e.target.value })}
              placeholder="Wat viel je op?"
              className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary"
            />
          </div>
        ))}
      </section>

      {exerciseNames.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Oefeningen</h3>
          <div>
            <div className="text-[12px] text-text-secondary mb-1.5">Behouden in volgend blok</div>
            <div className="flex flex-wrap gap-1.5">
              {exerciseNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...value, keepExercises: toggleExercise(value.keepExercises, n) })}
                  className={`px-2.5 py-1 rounded-full text-[12px] border ${
                    value.keepExercises.includes(n)
                      ? 'border-status-success/60 text-status-success bg-status-success/10'
                      : 'border-bg-border text-text-secondary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-text-secondary mb-1.5">Liever weg / vervangen</div>
            <div className="flex flex-wrap gap-1.5">
              {exerciseNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...value, dropExercises: toggleExercise(value.dropExercises, n) })}
                  className={`px-2.5 py-1 rounded-full text-[12px] border ${
                    value.dropExercises.includes(n)
                      ? 'border-status-danger/60 text-status-danger bg-status-danger/10'
                      : 'border-bg-border text-text-secondary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-text-secondary">Grootste win</span>
          <textarea
            value={value.biggestWin}
            onChange={(e) => onChange({ ...value, biggestWin: e.target.value })}
            rows={2}
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary resize-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-text-secondary">Grootste tegenvaller</span>
          <textarea
            value={value.biggestMiss}
            onChange={(e) => onChange({ ...value, biggestMiss: e.target.value })}
            rows={2}
            className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary resize-none"
          />
        </label>
      </section>

      {data.injuries.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Blessures</h3>
          {data.injuries.map((inj) => (
            <div key={inj.bodyLocation} className="flex items-center justify-between">
              <span className="text-[13px] text-text-primary">{inj.bodyLocation}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setInjuryUpdate(inj.bodyLocation, 'still_active')}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${
                    value.injuryUpdates[inj.bodyLocation] === 'still_active'
                      ? 'border-status-warning text-status-warning'
                      : 'border-bg-border text-text-tertiary'
                  }`}
                >
                  nog actief
                </button>
                <button
                  type="button"
                  onClick={() => setInjuryUpdate(inj.bodyLocation, 'resolved')}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${
                    value.injuryUpdates[inj.bodyLocation] === 'resolved'
                      ? 'border-status-success text-status-success'
                      : 'border-bg-border text-text-tertiary'
                  }`}
                >
                  opgelost
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </StepShell>
  )
}
