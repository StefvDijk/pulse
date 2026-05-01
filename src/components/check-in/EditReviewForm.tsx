'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Save } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'

interface EditableReview {
  id: string
  week_number: number
  week_start: string
  week_end: string
  summary_text: string | null
  notes_text: string | null
  previous_focus_rating: 'gehaald' | 'deels' | 'niet' | null
  previous_focus_note: string | null
  next_week_plan: { focusNextWeek?: string } | null
}

interface EditReviewFormProps {
  reviewId: string
}

export function EditReviewForm({ reviewId }: EditReviewFormProps) {
  const router = useRouter()
  const [review, setReview] = useState<EditableReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [summary, setSummary] = useState('')
  const [focus, setFocus] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/check-in/${reviewId}`)
        if (!res.ok) throw new Error('Laden mislukt')
        const data = (await res.json()) as EditableReview
        if (cancelled) return
        setReview(data)
        setSummary(data.summary_text ?? '')
        setFocus(data.next_week_plan?.focusNextWeek ?? '')
        setNotes(data.notes_text ?? '')
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Laden mislukt')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reviewId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/check-in/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary_text: summary,
          focus_next_week: focus,
          notes_text: notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      router.push('/check-in/history')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-lg p-6 text-sm text-text-tertiary">Laden…</div>
  }
  if (!review) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorAlert message={error ?? 'Review niet gevonden'} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg pb-8">
      <div className="px-4 pt-[60px] pb-2">
        <Link href="/check-in/history" className="-ml-1 flex w-fit items-center gap-0.5 text-[#0A84FF] active:opacity-60">
          <ChevronLeft size={22} strokeWidth={2.5} />
          <span className="text-[17px] tracking-[-0.2px]">Historie</span>
        </Link>
        <h1 className="mt-2 text-[28px] font-bold tracking-[-0.6px] text-text-primary">
          Week {review.week_number} bewerken
        </h1>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {/* Summary */}
        <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
          <label htmlFor="edit-summary" className="text-sm font-medium text-text-primary">
            Samenvatting
          </label>
          <textarea
            id="edit-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            maxLength={2000}
            className="mt-2 w-full resize-none rounded-xl border border-bg-border bg-white/[0.04] px-3 py-2 text-[16px] text-text-primary focus:border-[#0A84FF] focus:outline-none"
          />
        </div>

        {/* Focus */}
        <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
          <label htmlFor="edit-focus" className="text-sm font-medium text-text-primary">
            Focus volgende week
          </label>
          <input
            id="edit-focus"
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={500}
            className="mt-2 w-full rounded-xl border border-bg-border bg-white/[0.04] px-3 py-2 text-[16px] text-text-primary focus:border-[#0A84FF] focus:outline-none"
          />
        </div>

        {/* Reflectie / hoe was je week */}
        <div className="rounded-2xl border border-bg-border bg-bg-surface p-4">
          <label htmlFor="edit-notes" className="text-sm font-medium text-text-primary">
            Hoe was je week?
          </label>
          <textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            className="mt-2 w-full resize-none rounded-xl border border-bg-border bg-white/[0.04] px-3 py-2 text-[16px] text-text-primary focus:border-[#0A84FF] focus:outline-none"
          />
        </div>

        {error && <ErrorAlert message={error} />}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#0A84FF] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Opslaan
        </button>
      </div>
    </div>
  )
}
