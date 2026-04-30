'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Loader2,
  Pencil,
  X,
  Plus,
  Calendar,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Footprints,
} from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { useWeekPlan, type PlannedSession } from '@/hooks/useWeekPlan'
import type { CheckInReviewData } from '@/app/api/check-in/review/route'
import type { DayConflict, DayAvailability } from '@/lib/google/conflicts'
import { addDaysToKey } from '@/lib/time/amsterdam'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeekPlanCardProps {
  reviewData: CheckInReviewData
  onNext: (plan: PlannedSession[], syncToCalendar: boolean) => void
  weekStart: string
  weekEnd: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPORT_ICONS: Record<PlannedSession['type'], React.ReactNode> = {
  gym: <Dumbbell size={14} className="text-system-blue" />,
  run: <Footprints size={14} className="text-system-orange" />,
  padel: <span className="text-xs">🎾</span>,
}

const SPORT_BG: Record<PlannedSession['type'], string> = {
  gym: 'bg-system-blue/10',
  run: 'bg-system-orange/10',
  padel: 'bg-system-yellow/10',
}

const SPORT_BORDER: Record<PlannedSession['type'], string> = {
  gym: 'border-system-blue/20',
  run: 'border-system-orange/20',
  padel: 'border-system-yellow/20',
}

const SPORT_LABELS: Record<PlannedSession['type'], string> = {
  gym: 'Gym',
  run: 'Hardlopen',
  padel: 'Padel',
}

const DEFAULT_DURATIONS: Record<PlannedSession['type'], number> = {
  gym: 75,
  run: 45,
  padel: 90,
}

const DAY_ABBREVS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

function availabilityDot(availability: DayAvailability): string {
  switch (availability) {
    case 'available':
      return 'bg-system-green'
    case 'morning_only':
    case 'evening_only':
      return 'bg-system-orange'
    case 'unavailable':
      return 'bg-system-red'
  }
}

function availabilityLabel(availability: DayAvailability, reason: string): string | null {
  switch (availability) {
    case 'morning_only':
      return reason || 'Alleen ochtend'
    case 'evening_only':
      return reason || 'Alleen avond'
    case 'unavailable':
      return reason || 'Niet beschikbaar'
    case 'available':
      return null
  }
}

function getDayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay()
  return day === 0 ? 6 : day - 1 // Monday = 0, Sunday = 6
}

// ---------------------------------------------------------------------------
// Inline add form
// ---------------------------------------------------------------------------

interface AddFormProps {
  date: string
  onAdd: (session: PlannedSession) => void
  onCancel: () => void
}

function AddSessionForm({ date, onAdd, onCancel }: AddFormProps) {
  const [type, setType] = useState<PlannedSession['type']>('gym')
  const [time, setTime] = useState('07:00')
  const [workout, setWorkout] = useState('')

  const handleSubmit = useCallback(() => {
    const dayIdx = getDayIndex(date)
    const endTime = addMinutes(time, DEFAULT_DURATIONS[type])
    onAdd({
      day: DAY_ABBREVS[dayIdx] ?? '',
      date,
      workout: workout.trim() || SPORT_LABELS[type],
      type,
      time,
      endTime,
      location: null,
      reason: 'Handmatig toegevoegd',
    })
  }, [date, type, time, workout, onAdd])

  return (
    <div className="mt-2 rounded-xl bg-system-gray6 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {(['gym', 'run', 'padel'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              type === t
                ? `${SPORT_BG[t]} border ${SPORT_BORDER[t]}`
                : 'bg-surface-primary border border-separator text-label-tertiary'
            }`}
          >
            {SPORT_ICONS[t]}
            <span>{SPORT_LABELS[t]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-separator bg-surface-primary px-2.5 py-1.5 text-sm text-label-primary"
        />
        <input
          type="text"
          value={workout}
          onChange={(e) => setWorkout(e.target.value)}
          placeholder={SPORT_LABELS[type]}
          className="flex-1 rounded-lg border border-separator bg-surface-primary px-2.5 py-1.5 text-sm text-label-primary placeholder:text-label-tertiary"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-system-blue px-3 py-1.5 text-xs font-medium text-white"
        >
          Toevoegen
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-label-tertiary"
        >
          Annuleren
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline edit form
// ---------------------------------------------------------------------------

interface EditFormProps {
  session: PlannedSession
  onSave: (updated: PlannedSession) => void
  onCancel: () => void
}

function EditSessionForm({ session, onSave, onCancel }: EditFormProps) {
  const [time, setTime] = useState(session.time)

  const handleSave = useCallback(() => {
    const endTime = addMinutes(time, DEFAULT_DURATIONS[session.type])
    onSave({
      ...session,
      time,
      endTime,
    })
  }, [time, session, onSave])

  return (
    <div className="mt-2 rounded-xl bg-system-gray6 p-3 flex items-center gap-2">
      <label className="text-xs text-label-secondary">Starttijd:</label>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="rounded-lg border border-separator bg-surface-primary px-2.5 py-1.5 text-sm text-label-primary"
      />
      <button
        onClick={handleSave}
        className="rounded-lg bg-system-blue px-3 py-1.5 text-xs font-medium text-white"
      >
        Opslaan
      </button>
      <button
        onClick={onCancel}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-label-tertiary"
      >
        Annuleren
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Day row
// ---------------------------------------------------------------------------

interface DayRowProps {
  date: string
  dayIndex: number
  conflict: DayConflict | null
  session: PlannedSession | null
  editingDate: string | null
  addingDate: string | null
  onRemove: (date: string) => void
  onStartEdit: (date: string) => void
  onSaveEdit: (updated: PlannedSession) => void
  onCancelEdit: () => void
  onStartAdd: (date: string) => void
  onAdd: (session: PlannedSession) => void
  onCancelAdd: () => void
}

function DayRow({
  date,
  dayIndex,
  conflict,
  session,
  editingDate,
  addingDate,
  onRemove,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onStartAdd,
  onAdd,
  onCancelAdd,
}: DayRowProps) {
  const availability = conflict?.availability ?? 'available'
  const label = conflict ? availabilityLabel(conflict.availability, conflict.reason) : null
  const isEditing = editingDate === date
  const isAdding = addingDate === date

  return (
    <div className="py-2.5">
      {/* Day header */}
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-2 w-2 shrink-0 rounded-full ${availabilityDot(availability)}`} />
        <span className="text-sm font-medium text-label-primary">
          {DAY_ABBREVS[dayIndex]}
        </span>
        <span className="text-xs text-label-tertiary">{formatShortDate(date)}</span>
        {label && (
          <span className="text-xs text-label-tertiary">· {label}</span>
        )}
      </div>

      {/* Session card or rest day */}
      {session ? (
        <div className={`ml-4 rounded-xl border ${SPORT_BORDER[session.type]} ${SPORT_BG[session.type]} p-3`}>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-primary/60">
              {SPORT_ICONS[session.type]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-label-primary truncate">
                {session.workout}
              </p>
              <p className="text-xs text-label-tertiary">
                {session.time} – {session.endTime}
              </p>
            </div>
            <button
              onClick={() => onStartEdit(date)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-primary/60 text-label-tertiary"
              title="Aanpassen"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onRemove(date)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-primary/60 text-label-tertiary"
              title="Verwijderen"
            >
              <X size={12} />
            </button>
          </div>
          {isEditing && (
            <EditSessionForm
              session={session}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          )}
        </div>
      ) : (
        <div className="ml-4 flex items-center gap-2 py-1">
          <span className="text-xs text-label-tertiary">Geen training</span>
          <button
            onClick={() => onStartAdd(date)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-system-gray6 text-label-tertiary"
            title="Sessie toevoegen"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {/* Add form */}
      {isAdding && !session && (
        <div className="ml-4">
          <AddSessionForm
            date={date}
            onAdd={onAdd}
            onCancel={onCancelAdd}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WeekPlanCard({
  reviewData,
  onNext,
  weekStart,
  weekEnd,
}: WeekPlanCardProps) {
  const { plan, isLoading, error, generate, reset } = useWeekPlan()
  const hasFetched = useRef(false)

  const [sessions, setSessions] = useState<PlannedSession[]>([])
  const [syncToCalendar, setSyncToCalendar] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const [showReasoning, setShowReasoning] = useState(false)

  // Generate plan on mount
  useEffect(() => {
    if (hasFetched.current || plan) return
    hasFetched.current = true
    generate(weekStart, weekEnd)
  }, [generate, weekStart, weekEnd, plan])

  // Sync local sessions from generated plan
  useEffect(() => {
    if (plan?.sessions) {
      setSessions(plan.sessions)
    }
  }, [plan])

  // Build week dates array (inclusief).
  const weekDates = useMemo(() => {
    const dates: string[] = []
    let cursor = weekStart
    while (cursor <= weekEnd) {
      dates.push(cursor)
      cursor = addDaysToKey(cursor, 1)
    }
    return dates
  }, [weekStart, weekEnd])

  // Build conflict lookup
  const conflictMap = new Map<string, DayConflict>()
  if (plan?.conflicts?.days) {
    for (const dc of plan.conflicts.days) {
      conflictMap.set(dc.date, dc)
    }
  }

  // Build session lookup
  const sessionMap = new Map<string, PlannedSession>()
  for (const s of sessions) {
    sessionMap.set(s.date, s)
  }

  // Handlers
  const handleRemove = useCallback((date: string) => {
    setSessions((prev) => prev.filter((s) => s.date !== date))
    setEditingDate(null)
  }, [])

  const handleStartEdit = useCallback((date: string) => {
    setEditingDate(date)
    setAddingDate(null)
  }, [])

  const handleSaveEdit = useCallback((updated: PlannedSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.date === updated.date ? updated : s))
    )
    setEditingDate(null)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingDate(null)
  }, [])

  const handleStartAdd = useCallback((date: string) => {
    setAddingDate(date)
    setEditingDate(null)
  }, [])

  const handleAdd = useCallback((session: PlannedSession) => {
    setSessions((prev) => [...prev, session])
    setAddingDate(null)
  }, [])

  const handleCancelAdd = useCallback(() => {
    setAddingDate(null)
  }, [])

  const handleRetry = useCallback(() => {
    hasFetched.current = false
    reset()
    // useEffect re-triggers because plan becomes null and hasFetched is false
  }, [reset])

  const handleContinue = useCallback(() => {
    onNext(sessions, syncToCalendar)
  }, [onNext, sessions, syncToCalendar])

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-surface-primary border border-separator p-5">
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={28} className="animate-spin text-system-blue" />
          <p className="text-sm font-medium text-label-secondary">
            Plan wordt gemaakt...
          </p>
          <p className="text-xs text-label-tertiary">Dit duurt meestal 5-10 seconden</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorAlert message={error.message} onRetry={handleRetry} />
      </div>
    )
  }

  // Guard: no plan yet
  if (!plan) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Week plan card */}
      <div className="rounded-2xl bg-surface-primary border border-separator p-5">
        <h3 className="text-subhead font-semibold text-label-primary mb-3">Weekplan</h3>

        {/* Day grid */}
        <div className="divide-y divide-separator">
          {weekDates.map((date) => {
            const dayIdx = getDayIndex(date)
            return (
              <DayRow
                key={date}
                date={date}
                dayIndex={dayIdx}
                conflict={conflictMap.get(date) ?? null}
                session={sessionMap.get(date) ?? null}
                editingDate={editingDate}
                addingDate={addingDate}
                onRemove={handleRemove}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                onStartAdd={handleStartAdd}
                onAdd={handleAdd}
                onCancelAdd={handleCancelAdd}
              />
            )
          })}
        </div>
      </div>

      {/* AI reasoning (collapsible) */}
      {plan.reasoning && (
        <div className="rounded-2xl bg-surface-primary border border-separator p-5">
          <button
            onClick={() => setShowReasoning((prev) => !prev)}
            className="flex w-full items-center justify-between"
          >
            <span className="text-xs font-medium text-label-tertiary">AI redenering</span>
            {showReasoning ? (
              <ChevronUp size={14} className="text-label-tertiary" />
            ) : (
              <ChevronDown size={14} className="text-label-tertiary" />
            )}
          </button>
          {showReasoning && (
            <p className="mt-2 text-sm text-label-secondary leading-relaxed">
              {plan.reasoning}
            </p>
          )}
        </div>
      )}

      {/* Calendar sync toggle */}
      <div className="rounded-2xl bg-surface-primary border border-separator p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={syncToCalendar}
            onChange={(e) => setSyncToCalendar(e.target.checked)}
            className="h-4 w-4 rounded border-separator system-blue-system-blue"
          />
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-label-tertiary" />
            <span className="text-sm text-label-primary">Sync naar Google Agenda</span>
          </div>
        </label>
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        className="rounded-xl bg-system-blue px-5 py-2.5 text-sm font-medium text-white"
      >
        Bevestigen en opslaan
      </button>
    </div>
  )
}
