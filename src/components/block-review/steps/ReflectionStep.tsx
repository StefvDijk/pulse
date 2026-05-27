'use client'

import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { ExerciseVerdict, InjuryReviewStatus, MissedSession, ReflectionState, TemplateRating } from '../types'

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

const DIMENSIONS = [
  { key: 'volume', label: 'Volume', options: ['te_weinig', 'goed', 'te_veel'] },
  { key: 'intensity', label: 'Intensiteit', options: ['te_licht', 'goed', 'te_zwaar'] },
  { key: 'motivation', label: 'Motivatie', options: ['hoog', 'neutraal', 'laag'] },
  { key: 'recovery_cost', label: 'Herstel', options: ['makkelijk', 'normaal', 'zwaar'] },
] as const

const INJURY_STATUSES: Array<[InjuryReviewStatus, string]> = [
  ['verbeterd', 'verbeterd'],
  ['stabiel', 'stabiel'],
  ['verergerd', 'erger'],
  ['flare_up_gehad', 'flare-up'],
  ['opgelost', 'opgelost'],
]

const MISSED_REASONS: Array<[MissedSession['reason'], string]> = [
  ['ziek', 'Ziek'],
  ['druk', 'Druk'],
  ['blessure', 'Blessure'],
  ['motivatie', 'Motivatie'],
  ['vakantie', 'Vakantie'],
  ['overig', 'Overig'],
]

export function ReflectionStep({ data, value, onChange, endReason, onEndReasonChange, stepIndex, stepTotal, onBack, onNext }: Props) {
  const exerciseNames = data.exerciseProgressions.map((e) => e.exerciseName)

  function setTemplateRating(idx: number, partial: Partial<TemplateRating>) {
    const next = value.templateRatings.map((t, i) => (i === idx ? { ...t, ...partial } : t))
    onChange({ ...value, templateRatings: next })
  }

  function setInjuryUpdate(loc: string, status: InjuryReviewStatus) {
    onChange({ ...value, injuryUpdates: { ...value.injuryUpdates, [loc]: status } })
  }

  function setExerciseVerdict(name: string, verdict: 'keep' | 'drop' | 'neutral') {
    const clean: ExerciseVerdict = verdict === 'drop'
      ? { name, verdict }
      : { name, verdict, reason: undefined, painScore: undefined }
    const nextVerdicts = value.exerciseVerdicts.some((e) => e.name === name)
      ? value.exerciseVerdicts.map((e) => (e.name === name ? { ...clean, reason: verdict === 'drop' ? e.reason : undefined, painScore: verdict === 'drop' ? e.painScore : undefined } : e))
      : [...value.exerciseVerdicts, clean]
    onChange({
      ...value,
      exerciseVerdicts: nextVerdicts,
      keepExercises: verdict === 'keep' ? Array.from(new Set([...value.keepExercises, name])) : value.keepExercises.filter((x) => x !== name),
      dropExercises: verdict === 'drop' ? Array.from(new Set([...value.dropExercises, name])) : value.dropExercises.filter((x) => x !== name),
    })
  }

  function setExerciseVerdictDetail(name: string, partial: Partial<Pick<ExerciseVerdict, 'reason' | 'painScore'>>) {
    const nextVerdicts = value.exerciseVerdicts.map((e) =>
      e.name === name ? { ...e, ...partial, painScore: partial.reason !== undefined && partial.reason !== 'blessure' ? undefined : (partial.painScore ?? e.painScore) } : e,
    )
    onChange({ ...value, exerciseVerdicts: nextVerdicts })
  }

  const templatesWithMissed = data.templateAdherence.filter((t) => t.completed < t.planned)

  function setMissedReason(focus: string, reason: MissedSession['reason']) {
    const count = data.templateAdherence.find((t) => t.focus === focus)
    const missed = (count?.planned ?? 0) - (count?.completed ?? 0)
    if (missed <= 0) return
    const filtered = value.missedSessions.filter((m) => m.templateFocus !== focus)
    const entries: MissedSession[] = Array.from({ length: missed }, (_, i) => ({
      templateFocus: focus,
      week: i + 1,
      reason,
    }))
    onChange({ ...value, missedSessions: [...filtered, ...entries] })
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DIMENSIONS.map((dim) => (
                <div key={dim.key} className="flex flex-col gap-1">
                  <span className="text-[11px] text-text-tertiary">{dim.label}</span>
                  <div className="flex flex-wrap gap-1">
                    {dim.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setTemplateRating(idx, { [dim.key]: option } as Partial<TemplateRating>)}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
                          t[dim.key] === option
                            ? 'border-text-primary text-text-primary'
                            : 'border-bg-border text-text-secondary'
                        }`}
                      >
                        {option.replaceAll('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[12px] text-text-secondary">
              <input
                type="checkbox"
                checked={t.time_pressure}
                onChange={(e) => setTemplateRating(idx, { time_pressure: e.target.checked })}
              />
              liep vaak over 55 min
            </label>
            <input
              value={t.note}
              onChange={(e) => setTemplateRating(idx, { note: e.target.value })}
              placeholder="Wat viel je op?"
              className="px-3 py-2 bg-bg-base border border-bg-border rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary"
            />
          </div>
        ))}
      </section>

      {templatesWithMissed.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Gemiste sessies</h3>
          {templatesWithMissed.map((t) => {
            const missed = t.planned - t.completed
            const currentReason = value.missedSessions.find((m) => m.templateFocus === t.focus)?.reason
            return (
              <div key={t.focus} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-text-primary">{t.focus}</span>
                  <span className="text-[12px] text-text-tertiary">{missed}× gemist</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MISSED_REASONS.map(([reason, label]) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setMissedReason(t.focus, reason)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${
                        currentReason === reason
                          ? 'border-text-primary text-text-primary'
                          : 'border-bg-border text-text-tertiary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {exerciseNames.length > 0 && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Oefeningen</h3>
          <div className="flex flex-col gap-2">
            {exerciseNames.map((n) => {
              const ev = value.exerciseVerdicts.find((e) => e.name === n)
              const verdict = ev?.verdict ?? 'neutral'
              return (
                <div key={n} className="rounded-md border border-bg-border p-2">
                  <div className="mb-2 text-[13px] text-text-primary">{n}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['keep', 'neutral', 'drop'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setExerciseVerdict(n, v)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] ${
                          verdict === v
                            ? v === 'drop'
                              ? 'border-status-danger text-status-danger'
                              : v === 'keep'
                                ? 'border-status-success text-status-success'
                                : 'border-text-primary text-text-primary'
                            : 'border-bg-border text-text-secondary'
                        }`}
                      >
                        {v === 'keep' ? 'houden' : v === 'drop' ? 'weg' : 'neutraal'}
                      </button>
                    ))}
                  </div>
                  {verdict === 'drop' && (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(['blessure', 'stagnatie', 'verveling', 'techniek'] as const).map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => setExerciseVerdictDetail(n, { reason })}
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${
                              ev?.reason === reason
                                ? 'border-status-danger text-status-danger'
                                : 'border-bg-border text-text-tertiary'
                            }`}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                      {ev?.reason === 'blessure' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-text-tertiary">Pijn</span>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            value={ev.painScore ?? 5}
                            onChange={(e) => setExerciseVerdictDetail(n, { painScore: Number(e.target.value) })}
                            className="flex-1 accent-status-danger"
                          />
                          <span className="text-[12px] text-text-secondary w-5 text-right">{ev.painScore ?? 5}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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
            <div key={inj.bodyLocation} className="flex flex-col gap-2">
              <span className="text-[13px] text-text-primary">{inj.bodyLocation}</span>
              <div className="flex flex-wrap gap-1.5">
                {INJURY_STATUSES.map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setInjuryUpdate(inj.bodyLocation, status)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      value.injuryUpdates[inj.bodyLocation] === status
                        ? 'border-text-primary text-text-primary'
                        : 'border-bg-border text-text-tertiary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

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
    </StepShell>
  )
}
