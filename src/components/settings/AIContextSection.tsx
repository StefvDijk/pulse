'use client'

import { useState } from 'react'
import { useSaveStatus, SaveButton, SectionHeader, INPUT_CLASSES } from './shared'

interface AIContextSectionProps {
  currentValue: string | null
  onSaved: () => void
}

const MAX_CHARS = 2000

export function AIContextSection({ currentValue, onSaved }: AIContextSectionProps) {
  const [value, setValue] = useState(currentValue ?? '')
  const [syncedCurrentValue, setSyncedCurrentValue] = useState(currentValue)
  const [status, save] = useSaveStatus()

  // React docs idiom: adjust state during render when a tracked prop changes.
  // Replaces a useEffect(setValue) sync pattern that triggered cascading renders.
  if (currentValue !== syncedCurrentValue) {
    setSyncedCurrentValue(currentValue)
    setValue(currentValue ?? '')
  }

  async function handleSave() {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { ai_custom_instructions: value.trim() || null },
      }),
    }).then((r) => { if (!r.ok) throw new Error() })
    onSaved()
  }

  return (
    <div className="bg-bg-surface border border-bg-border rounded-[14px] p-[14px_16px]">
      <SectionHeader title="Coach Instructies" />
      <p className="mb-3 text-xs text-text-tertiary">
        Persoonlijke instructies voor je AI coach. Deze worden bij elk gesprek meegestuurd.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
        rows={4}
        placeholder="Bijv: Focus op krachtopbouw, niet op afvallen. Geef altijd alternatieven bij schouderpijn."
        className={`${INPUT_CLASSES} w-full resize-none`}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-text-tertiary">
          {value.length}/{MAX_CHARS}
        </span>
        <SaveButton state={status} onClick={() => save(handleSave)} />
      </div>
    </div>
  )
}
