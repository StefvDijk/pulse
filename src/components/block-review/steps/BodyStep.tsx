'use client'

import { useState } from 'react'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState, NewInBodyState } from '../types'

interface Props {
  data: BlockReviewData
  newInBody: BlockReviewFormState['newInBody']
  onChange: (next: BlockReviewFormState['newInBody']) => void
  stepIndex: number
  stepTotal: number
  onBack?: () => void
  onNext: () => void
}

function Stat({ label, value, delta, unit }: { label: string; value: number | null; delta: number | null; unit: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span className="text-[14px] tabular-nums text-text-primary">
        {value ?? '—'}
        {value !== null && unit}
        {delta !== null && delta !== 0 && (
          <span className={`ml-2 text-[12px] ${delta > 0 ? 'text-status-success' : 'text-status-danger'}`}>
            {delta > 0 ? '+' : ''}
            {delta}
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  step: number
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-text-secondary flex-1">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-24 px-2 py-1 bg-bg-base border border-bg-border rounded text-right text-[14px] tabular-nums text-text-primary"
      />
    </label>
  )
}

function defaultInBody(): NewInBodyState {
  return {
    measuredAt: new Date().toISOString().slice(0, 10),
    weightKg: null,
    skeletalMuscleMassKg: null,
    fatMassKg: null,
    fatPct: null,
    visceralFatLevel: null,
    waistCm: null,
  }
}

export function BodyStep({ data, newInBody, onChange, stepIndex, stepTotal, onBack, onNext }: Props) {
  const { bodyTimeline, bodyDelta, wellnessAverages } = data
  const last = bodyTimeline[bodyTimeline.length - 1]
  const [adding, setAdding] = useState(false)

  function update<K extends keyof NewInBodyState>(k: K, v: NewInBodyState[K]) {
    const base = newInBody ?? defaultInBody()
    onChange({ ...base, [k]: v })
  }

  return (
    <StepShell
      title="Lichaam"
      subtitle={`${bodyTimeline.length} metingen in dit blok`}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      onBack={onBack}
      onNext={onNext}
    >
      {last ? (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Laatste meting · {last.date}
          </h3>
          <Stat label="Gewicht" value={last.weightKg} delta={bodyDelta.weightKg} unit="kg" />
          <Stat label="Spiermassa" value={last.skeletalMuscleMassKg} delta={bodyDelta.skeletalMuscleMassKg} unit="kg" />
          <Stat label="Vetmassa" value={last.fatMassKg} delta={bodyDelta.fatMassKg} unit="kg" />
          <Stat label="Vet%" value={last.fatPct} delta={bodyDelta.fatPct} unit="%" />
          <Stat label="Buikomtrek" value={last.waistCm} delta={null} unit="cm" />
        </section>
      ) : (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 text-[13px] text-text-tertiary">
          Geen InBody-metingen in dit blok.
        </section>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Wellness gemiddelde</h3>
        <Stat label="Energie (gemiddeld)" value={wellnessAverages.feeling} delta={null} unit="/5" />
        <Stat label="Slaap-kwaliteit" value={wellnessAverages.sleepQuality} delta={null} unit="/5" />
        <div className="text-[11px] text-text-tertiary mt-1">Gebaseerd op {wellnessAverages.checkinCount} check-ins</div>
      </section>

      <button
        type="button"
        onClick={() => setAdding((b) => !b)}
        className="rounded-card-lg bg-bg-surface border border-bg-border p-4 text-[14px] text-text-primary text-left active:opacity-70"
      >
        {adding ? '× Annuleer meting' : '+ Nieuwe InBody-meting toevoegen'}
      </button>

      {adding && (
        <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 flex flex-col gap-2">
          <NumberInput label="Gewicht (kg)" value={newInBody?.weightKg ?? null} onChange={(v) => update('weightKg', v)} step={0.1} />
          <NumberInput label="Spiermassa (kg)" value={newInBody?.skeletalMuscleMassKg ?? null} onChange={(v) => update('skeletalMuscleMassKg', v)} step={0.1} />
          <NumberInput label="Vetmassa (kg)" value={newInBody?.fatMassKg ?? null} onChange={(v) => update('fatMassKg', v)} step={0.1} />
          <NumberInput label="Vet%" value={newInBody?.fatPct ?? null} onChange={(v) => update('fatPct', v)} step={0.1} />
          <NumberInput label="Buikomtrek (cm)" value={newInBody?.waistCm ?? null} onChange={(v) => update('waistCm', v)} step={0.5} />
        </section>
      )}
    </StepShell>
  )
}
