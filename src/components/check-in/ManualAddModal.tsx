'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { ManualAddition } from '@/components/check-in/CheckInFlow'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ManualAddModalProps {
  onAdd: (addition: ManualAddition) => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Type selection
// ---------------------------------------------------------------------------

type AdditionType = 'padel' | 'inbody' | 'note'

const TYPE_OPTIONS: { type: AdditionType; label: string; icon: string }[] = [
  { type: 'padel', label: 'Padel', icon: '🎾' },
  { type: 'inbody', label: 'InBody', icon: '⚖️' },
  { type: 'note', label: 'Notitie', icon: '📝' },
]

// ---------------------------------------------------------------------------
// Padel form
// ---------------------------------------------------------------------------

function PadelForm({ onSubmit }: { onSubmit: (addition: ManualAddition) => void }) {
  const [duration, setDuration] = useState('')
  const [intensity, setIntensity] = useState<'light' | 'normal' | 'heavy'>('normal')

  const intensityLabels = [
    { value: 'light' as const, label: 'Licht' },
    { value: 'normal' as const, label: 'Normaal' },
    { value: 'heavy' as const, label: 'Zwaar' },
  ]

  function handleSubmit() {
    const mins = parseInt(duration, 10)
    if (isNaN(mins) || mins <= 0) return
    onSubmit({
      type: 'padel',
      data: { duration_minutes: mins, intensity },
      label: `Padel · ${mins} min · ${intensityLabels.find((l) => l.value === intensity)?.label}`,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-text-tertiary mb-1 block">
          Duur (minuten)
        </label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="60"
          min={1}
          className="w-full rounded-lg border border-bg-border bg-system-gray6 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-text-tertiary mb-2 block">
          Intensiteit
        </label>
        <div className="flex gap-2">
          {intensityLabels.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setIntensity(opt.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                intensity === opt.value
                  ? 'bg-system-yellow/10 text-system-yellow border border-system-yellow/30'
                  : 'bg-system-gray6 text-text-secondary border border-bg-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!duration || parseInt(duration, 10) <= 0}
        className="rounded-xl bg-system-blue px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Toevoegen
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InBody form
// ---------------------------------------------------------------------------

function InBodyForm({ onSubmit }: { onSubmit: (addition: ManualAddition) => void }) {
  const [weight, setWeight] = useState('')
  const [muscleMass, setMuscleMass] = useState('')
  const [fatMass, setFatMass] = useState('')
  const [fatPct, setFatPct] = useState('')
  const [waist, setWaist] = useState('')

  function handleSubmit() {
    const w = parseFloat(weight)
    if (isNaN(w) || w <= 0) return

    const data: Record<string, unknown> = { weight_kg: w }
    const mm = parseFloat(muscleMass)
    if (!isNaN(mm) && mm > 0) data.muscle_mass_kg = mm
    const fm = parseFloat(fatMass)
    if (!isNaN(fm) && fm > 0) data.fat_mass_kg = fm
    const fp = parseFloat(fatPct)
    if (!isNaN(fp) && fp >= 0) data.fat_pct = fp
    const wc = parseFloat(waist)
    if (!isNaN(wc) && wc > 0) data.waist_cm = wc

    const parts = [`${w}kg`]
    if (data.fat_pct != null) parts.push(`${data.fat_pct}% vet`)
    if (data.muscle_mass_kg != null) parts.push(`${data.muscle_mass_kg}kg spier`)

    onSubmit({
      type: 'inbody',
      data,
      label: `InBody · ${parts.join(' · ')}`,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium text-text-tertiary mb-1 block">
          Gewicht (kg) *
        </label>
        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="82.5"
          className="w-full rounded-lg border border-bg-border bg-system-gray6 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-tertiary mb-1 block">
            Spiermassa (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={muscleMass}
            onChange={(e) => setMuscleMass(e.target.value)}
            placeholder="38.0"
            className="w-full rounded-lg border border-bg-border bg-system-gray6 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-tertiary mb-1 block">
            Vetmassa (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={fatMass}
            onChange={(e) => setFatMass(e.target.value)}
            placeholder="12.5"
            className="w-full rounded-lg border border-bg-border bg-system-gray6 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-tertiary mb-1 block">
            Vetpercentage (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={fatPct}
            onChange={(e) => setFatPct(e.target.value)}
            placeholder="15.0"
            className="w-full rounded-lg border border-bg-border bg-system-gray6 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-tertiary mb-1 block">
            Tailleomtrek (cm)
          </label>
          <input
            type="number"
            step="0.1"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
            placeholder="82.0"
            className="w-full rounded-lg border border-bg-border bg-system-gray6 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!weight || parseFloat(weight) <= 0}
        className="rounded-xl bg-system-blue px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Toevoegen
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Note form
// ---------------------------------------------------------------------------

function NoteForm({ onSubmit }: { onSubmit: (addition: ManualAddition) => void }) {
  const [text, setText] = useState('')

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit({
      type: 'note',
      data: { text: trimmed },
      label: `Notitie: ${trimmed.length > 40 ? trimmed.slice(0, 40) + '...' : trimmed}`,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-text-tertiary mb-1 block">
          Notitie
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bijv. lichte kniepijn bij squats, extra wandeling gemaakt..."
          rows={3}
          className="w-full rounded-lg border border-bg-border bg-system-gray6 px-3 py-2 text-sm text-text-primary outline-none resize-none placeholder:text-text-tertiary"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="rounded-xl bg-system-blue px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Toevoegen
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function ManualAddModal({ onAdd, onClose }: ManualAddModalProps) {
  const [selectedType, setSelectedType] = useState<AdditionType | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-bg-surface shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {selectedType ? 'Toevoegen' : 'Wat wil je toevoegen?'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-system-gray6 text-text-tertiary hover:bg-system-gray6"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5">
          {!selectedType ? (
            /* Type selection */
            <div className="flex flex-col gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setSelectedType(opt.type)}
                  className="flex items-center gap-3 rounded-xl border border-bg-border bg-bg-surface p-4 text-left transition-colors hover:bg-system-gray6"
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                </button>
              ))}
            </div>
          ) : selectedType === 'padel' ? (
            <PadelForm onSubmit={onAdd} />
          ) : selectedType === 'inbody' ? (
            <InBodyForm onSubmit={onAdd} />
          ) : (
            <NoteForm onSubmit={onAdd} />
          )}
        </div>
      </div>
    </div>
  )
}
