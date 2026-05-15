'use client'

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'

export interface QuickCheckinValue {
  feeling: number
  sleep_quality: number
  note: string | null
}

export interface QuickCheckInSheetProps {
  open: boolean
  onClose: () => void
  /** Pre-fill when the user already checked in today (lets them refine). */
  existing?: QuickCheckinValue | null
  /** Called with the persisted row after a successful save. */
  onSaved?: (result: QuickCheckinValue & { date: string }) => void
}

const FEELING_LABELS = ['Slecht', 'Matig', 'Oké', 'Goed', 'Top']
const SLEEP_LABELS = ['Slecht', 'Onrustig', 'Oké', 'Goed', 'Diep']

function ScaleRow({
  label,
  scaleLabels,
  value,
  onChange,
}: {
  label: string
  scaleLabels: string[]
  value: number | null
  onChange: (v: number) => void
}) {
  const labelForValue = value !== null ? scaleLabels[value - 1] : null
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <div className="text-[13px] font-semibold uppercase tracking-[0.4px] text-text-secondary">
          {label}
        </div>
        <div className="text-[13px] text-text-tertiary">{labelForValue ?? ' '}</div>
      </div>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = n === value
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${n} — ${scaleLabels[n - 1]}`}
              onClick={() => onChange(n)}
              className={`flex h-14 flex-1 items-center justify-center rounded-[16px] border-[0.5px] text-[18px] font-semibold tabular-nums transition-all active:scale-[0.97] ${
                selected
                  ? 'border-white/20 bg-white/[0.10] text-text-primary'
                  : 'border-white/[0.08] bg-white/[0.03] text-text-tertiary'
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function QuickCheckInSheet({
  open,
  onClose,
  existing,
  onSaved,
}: QuickCheckInSheetProps) {
  const [feeling, setFeeling] = useState<number | null>(existing?.feeling ?? null)
  const [sleep, setSleep] = useState<number | null>(existing?.sleep_quality ?? null)
  const [note, setNote] = useState(existing?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync state when the sheet (re)opens with different existing data.
  useEffect(() => {
    if (!open) return
    setFeeling(existing?.feeling ?? null)
    setSleep(existing?.sleep_quality ?? null)
    setNote(existing?.note ?? '')
    setError(null)
  }, [open, existing])

  const canSave = feeling !== null && sleep !== null && !saving

  async function handleSave() {
    if (feeling === null || sleep === null) return
    setSaving(true)
    setError(null)
    try {
      const trimmed = note.trim()
      const res = await fetch('/api/check-in/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeling,
          sleep_quality: sleep,
          note: trimmed.length > 0 ? trimmed : null,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Opslaan mislukt')
      }
      const saved = (await res.json()) as {
        date: string
        feeling: number
        sleep_quality: number
        note: string | null
      }
      onSaved?.({
        date: saved.date,
        feeling: saved.feeling,
        sleep_quality: saved.sleep_quality,
        note: saved.note,
      })
      onClose()
    } catch (err) {
      console.error('[QuickCheckInSheet] save failed:', err)
      setError(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} detents={['medium', 'large']} title="Snelle check-in">
      <div className="flex flex-col gap-5 px-5 pb-6 pt-1">
        <p className="text-[14px] leading-[1.45] text-text-secondary">
          Hoe voel je je vandaag? Duurt ongeveer 30 seconden.
        </p>

        <ScaleRow
          label="Hoe voel je je?"
          scaleLabels={FEELING_LABELS}
          value={feeling}
          onChange={setFeeling}
        />

        <ScaleRow
          label="Hoe sliep je?"
          scaleLabels={SLEEP_LABELS}
          value={sleep}
          onChange={setSleep}
        />

        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-semibold uppercase tracking-[0.4px] text-text-secondary">
            Iets toe te voegen?
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            placeholder="Optioneel — wat zit er in je hoofd?"
            rows={3}
            className="min-h-[88px] resize-none rounded-[16px] border-[0.5px] border-white/[0.10] bg-white/[0.03] px-3.5 py-3 text-[15px] leading-[1.45] text-text-primary placeholder:text-text-tertiary focus:border-white/30 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-[12px] bg-status-bad/10 px-3 py-2 text-[13px] text-status-bad">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border-[0.5px] border-white/[0.10] bg-white/[0.04] py-3 text-[15px] font-medium text-text-secondary transition-all active:opacity-70 disabled:opacity-50"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-full bg-[#0A84FF] py-3 text-[15px] font-semibold text-white transition-all active:opacity-80 disabled:opacity-40"
          >
            {saving ? 'Opslaan…' : existing ? 'Bijwerken' : 'Opslaan'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
