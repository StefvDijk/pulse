'use client'

import { useState } from 'react'
import { X, Loader2, RotateCcw } from 'lucide-react'
import type { SchemaDay, SchemaScheduleItem } from '@/hooks/useSchema'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface EditWeekModalProps {
  weekNumber: number
  days: SchemaDay[]
  templateSchedule: SchemaScheduleItem[]
  onClose: () => void
  onSaved: () => void
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Maandag',
  tuesday: 'Dinsdag',
  wednesday: 'Woensdag',
  thursday: 'Donderdag',
  friday: 'Vrijdag',
  saturday: 'Zaterdag',
  sunday: 'Zondag',
}

interface DayDraft {
  date: string
  dayName: string
  /** Resulting focus: '' = rest, otherwise workout title. */
  focus: string
  /** Whether this day's value differs from what was loaded. */
  dirty: boolean
  /** Original loaded value, used for the reset affordance. */
  originalFocus: string
}

function templateFocusFor(dayName: string, template: SchemaScheduleItem[]): string {
  return template.find((s) => s.day.toLowerCase() === dayName)?.focus ?? ''
}

export function EditWeekModal({
  weekNumber,
  days,
  templateSchedule,
  onClose,
  onSaved,
}: EditWeekModalProps) {
  useBodyScrollLock(true)
  const [drafts, setDrafts] = useState<DayDraft[]>(() =>
    days.map((d) => ({
      date: d.date,
      dayName: d.dayName,
      focus: d.workoutFocus ?? '',
      originalFocus: d.workoutFocus ?? '',
      dirty: false,
    })),
  )

  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function updateDraft(date: string, focus: string) {
    setDrafts((prev) =>
      prev.map((d) => (d.date === date ? { ...d, focus, dirty: focus !== d.originalFocus } : d)),
    )
  }

  function resetToTemplate(date: string, dayName: string) {
    const templateFocus = templateFocusFor(dayName, templateSchedule)
    updateDraft(date, templateFocus)
  }

  async function handleSave() {
    setStatus('saving')
    setErrorMsg(null)

    // Build overrides payload. We send EVERY day in the week so the user's
    // intent is unambiguous: each day either has a focus or is explicitly rest.
    // Days that exactly equal the template can instead be cleared, so the
    // schema reverts to its template if the template ever changes.
    const overrides: Record<string, string | null> = {}
    const clear: string[] = []

    for (const draft of drafts) {
      const templateFocus = templateFocusFor(draft.dayName, templateSchedule)
      if (draft.focus === templateFocus) {
        // Matches template — drop any existing override.
        clear.push(draft.date)
      } else if (draft.focus === '') {
        overrides[draft.date] = null
      } else {
        overrides[draft.date] = draft.focus
      }
    }

    try {
      const res = await fetch('/api/schema/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides, clear }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Opslaan mislukt')
      }

      onSaved()
      onClose()
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  const dirtyCount = drafts.filter((d) => d.dirty).length

  // Quick-pick suggestions: template focuses + a few common alternates.
  const templateFocuses = templateSchedule.map((s) => s.focus)
  const suggestions = Array.from(
    new Set([
      ...templateFocuses,
      'Hardlopen',
      'Bodyweight Circuit',
      'Easy Run',
      'Padel',
    ]),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={status === 'saving' ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-bg-surface shadow-2xl max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Week {weekNumber} aanpassen
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Pas per dag aan of laat leeg voor rust
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'saving'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary hover:bg-white/[0.06] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Day list */}
        <div className="flex flex-col gap-2 px-5 pb-3">
          {drafts.map((draft) => {
            const templateFocus = templateFocusFor(draft.dayName, templateSchedule)
            const dateNum = new Date(draft.date + 'T00:00:00Z').getUTCDate()
            const showResetButton = draft.focus !== templateFocus

            return (
              <div
                key={draft.date}
                className={`rounded-xl border p-3 transition-colors ${
                  draft.dirty ? 'border-[#0A84FF] bg-[#0A84FF]/5' : 'border-bg-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      {DAY_LABELS[draft.dayName] ?? draft.dayName}
                    </span>
                    <span className="ml-1.5 text-xs text-text-tertiary tabular-nums">
                      {dateNum}
                    </span>
                  </div>
                  {showResetButton && (
                    <button
                      onClick={() => resetToTemplate(draft.date, draft.dayName)}
                      className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-secondary"
                      title={`Terug naar template (${templateFocus || 'rust'})`}
                    >
                      <RotateCcw size={11} />
                      Reset
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={draft.focus}
                  onChange={(e) => updateDraft(draft.date, e.target.value)}
                  placeholder="Rustdag"
                  list={`suggestions-${draft.date}`}
                  className="w-full rounded-lg border border-bg-border bg-white/[0.06] px-3 py-2 text-[16px] text-text-primary outline-none focus:border-[#0A84FF]"
                />
                <datalist id={`suggestions-${draft.date}`}>
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            )
          })}
        </div>

        {errorMsg && (
          <div className="mx-5 mb-3 rounded-lg bg-[var(--color-status-bad)]/10 px-3 py-2 text-sm text-[var(--color-status-bad)]">
            {errorMsg}
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-bg-border bg-bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <span className="text-sm text-text-tertiary">
            {dirtyCount === 0 ? 'Geen wijzigingen' : `${dirtyCount} wijziging${dirtyCount === 1 ? '' : 'en'}`}
          </span>
          <button
            onClick={handleSave}
            disabled={status === 'saving' || dirtyCount === 0}
            className="flex items-center gap-2 rounded-xl bg-[#0A84FF] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === 'saving' && <Loader2 size={16} className="animate-spin" />}
            Opslaan
          </button>
        </div>
      </div>
    </div>
  )
}
