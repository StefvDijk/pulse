'use client'

import { useState } from 'react'
import type { Database } from '@/types/database'

type GoalRow = Database['public']['Tables']['goals']['Row']

export interface GoalFormProps {
  onSave: (goal: GoalRow) => void
  onCancel: () => void
}

const CATEGORIES = [
  { value: 'strength', label: 'Kracht' },
  { value: 'running', label: 'Hardlopen' },
  { value: 'padel', label: 'Padel' },
  { value: 'nutrition', label: 'Voeding' },
  { value: 'general', label: 'Algemeen' },
] as const

const TARGET_TYPES = [
  { value: 'max', label: 'Maximaliseren (bijv. zwaarder tillen)' },
  { value: 'min', label: 'Minimaliseren (bijv. sneller lopen)' },
  { value: 'count', label: 'Aantal (bijv. sessies per week)' },
] as const

export function GoalForm({ onSave, onCancel }: GoalFormProps) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('strength')
  const [targetValue, setTargetValue] = useState('')
  const [targetUnit, setTargetUnit] = useState('')
  const [targetType, setTargetType] = useState<string>('max')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          target_value: targetValue ? Number(targetValue) : null,
          target_unit: targetUnit.trim() || null,
          target_type: targetType,
          deadline: deadline || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Opslaan mislukt')
      }

      const goal: GoalRow = await res.json()
      onSave(goal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg p-2 text-sm" style={{ backgroundColor: '#2a0a0a', color: '#ef4444' }}>
          {error}
        </p>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Doel *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bijv. Bench press 100kg"
          required
          className="rounded-lg px-3 py-2 text-sm outline-none transition-colors"
          style={{
            backgroundColor: '#0a0a0f',
            border: '1px solid #1a1a2e',
            color: '#f0f0f5',
          }}
        />
      </div>

      {/* Category + Target type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Categorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#0a0a0f', border: '1px solid #1a1a2e', color: '#f0f0f5' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Type</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#0a0a0f', border: '1px solid #1a1a2e', color: '#f0f0f5' }}
          >
            {TARGET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Target value + unit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Streefwaarde</label>
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="100"
            min={0}
            step="any"
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#0a0a0f', border: '1px solid #1a1a2e', color: '#f0f0f5' }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Eenheid</label>
          <input
            type="text"
            value={targetUnit}
            onChange={(e) => setTargetUnit(e.target.value)}
            placeholder="kg, km, sessies…"
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: '#0a0a0f', border: '1px solid #1a1a2e', color: '#f0f0f5' }}
          />
        </div>
      </div>

      {/* Deadline */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: '#8888a0' }}>Deadline (optioneel)</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ backgroundColor: '#0a0a0f', border: '1px solid #1a1a2e', color: '#f0f0f5' }}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ color: '#8888a0' }}
        >
          Annuleer
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#4f8cff', color: '#fff' }}
        >
          {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>
    </form>
  )
}
