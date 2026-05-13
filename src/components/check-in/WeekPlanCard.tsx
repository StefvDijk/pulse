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
import { useWeekPlan, type PlannedSession, type LoadProjection } from '@/hooks/useWeekPlan'
import { PlanChat, type PlanChatTurn } from '@/components/check-in/PlanChat'
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
  gym: <Dumbbell size={14} className="text-[#0A84FF]" />,
  run: <Footprints size={14} className="text-[var(--color-status-warn)]" />,
  padel: <span className="text-xs">🎾</span>,
}

const SPORT_BG: Record<PlannedSession['type'], string> = {
  gym: 'bg-[#0A84FF]/10',
  run: 'bg-[var(--color-status-warn)]/10',
  padel: 'bg-[var(--color-status-warn)]/10',
}

const SPORT_BORDER: Record<PlannedSession['type'], string> = {
  gym: 'border-[#0A84FF]/20',
  run: 'border-[var(--color-status-warn)]/20',
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
      return 'bg-[var(--color-status-good)]'
    case 'morning_only':
    case 'evening_only':
      return 'bg-[var(--color-status-warn)]'
    case 'unavailable':
      return 'bg-[var(--color-status-bad)]'
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
    <div className="mt-2 rounded-xl bg-white/[0.06] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {(['gym', 'run', 'padel'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              type === t
                ? `${SPORT_BG[t]} border ${SPORT_BORDER[t]}`
                : 'bg-bg-surface border border-bg-border text-text-tertiary'
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
          className="rounded-lg border border-bg-border bg-bg-surface px-2.5 py-1.5 text-[16px] text-text-primary"
        />
        <input
          type="text"
          value={workout}
          onChange={(e) => setWorkout(e.target.value)}
          placeholder={SPORT_LABELS[type]}
          className="flex-1 rounded-lg border border-bg-border bg-bg-surface px-2.5 py-1.5 text-[16px] text-text-primary placeholder:text-text-tertiary"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-[#0A84FF] px-3 py-1.5 text-xs font-medium text-white"
        >
          Toevoegen
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-tertiary"
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
    <div className="mt-2 rounded-xl bg-white/[0.06] p-3 flex items-center gap-2">
      <label className="text-xs text-text-secondary">Starttijd:</label>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="rounded-lg border border-bg-border bg-bg-surface px-2.5 py-1.5 text-sm text-text-primary"
      />
      <button
        onClick={handleSave}
        className="rounded-lg bg-[#0A84FF] px-3 py-1.5 text-xs font-medium text-white"
      >
        Opslaan
      </button>
      <button
        onClick={onCancel}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-tertiary"
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
  sessions: PlannedSession[]
  editingDate: string | null
  addingDate: string | null
  onRemove: (date: string, time: string) => void
  onStartEdit: (sessionKey: string) => void
  onSaveEdit: (originalDate: string, originalTime: string, updated: PlannedSession) => void
  onCancelEdit: () => void
  onStartAdd: (date: string) => void
  onAdd: (session: PlannedSession) => void
  onCancelAdd: () => void
}

function DayRow({
  date,
  dayIndex,
  conflict,
  sessions,
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
  const isAdding = addingDate === date

  return (
    <div className="py-2.5">
      {/* Day header */}
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-2 w-2 shrink-0 rounded-full ${availabilityDot(availability)}`} />
        <span className="text-sm font-medium text-text-primary">
          {DAY_ABBREVS[dayIndex]}
        </span>
        <span className="text-xs text-text-tertiary">{formatShortDate(date)}</span>
        {label && (
          <span className="text-xs text-text-tertiary">· {label}</span>
        )}
      </div>

      {/* Session cards (one or more) */}
      {sessions.length > 0 ? (
        <div className="ml-4 flex flex-col gap-1.5">
          {sessions.map((session) => {
            const sessionKey = `${session.date}T${session.time}`
            const isEditing = editingDate === sessionKey
            return (
              <div
                key={sessionKey}
                className={`rounded-xl border ${SPORT_BORDER[session.type]} ${SPORT_BG[session.type]} p-3`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-surface/60">
                    {SPORT_ICONS[session.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{session.workout}</p>
                    <p className="text-xs text-text-tertiary">
                      {session.time} – {session.endTime}
                    </p>
                  </div>
                  <button
                    onClick={() => onStartEdit(sessionKey)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-surface/60 text-text-tertiary"
                    title="Aanpassen"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => onRemove(session.date, session.time)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-surface/60 text-text-tertiary"
                    title="Verwijderen"
                  >
                    <X size={12} />
                  </button>
                </div>
                {isEditing && (
                  <EditSessionForm
                    session={session}
                    onSave={(updated) => onSaveEdit(session.date, session.time, updated)}
                    onCancel={onCancelEdit}
                  />
                )}
              </div>
            )
          })}
          {/* Always offer +extra sessie button when there's already a session */}
          {!isAdding && (
            <button
              onClick={() => onStartAdd(date)}
              className="flex w-fit items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-text-tertiary hover:bg-white/[0.10]"
            >
              <Plus size={11} /> Extra sessie
            </button>
          )}
        </div>
      ) : (
        <div className="ml-4 flex items-center gap-2 py-1">
          <span className="text-xs text-text-tertiary">Geen training</span>
          <button
            onClick={() => onStartAdd(date)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-text-tertiary"
            title="Sessie toevoegen"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {/* Add form (separate from sessions list) */}
      {isAdding && (
        <div className="ml-4 mt-1.5">
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
  const [syncedPlan, setSyncedPlan] = useState(plan)
  const [syncToCalendar, setSyncToCalendar] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const [showReasoning, setShowReasoning] = useState(false)
  const [chatHistory, setChatHistory] = useState<PlanChatTurn[]>([])
  const [refinedReasoning, setRefinedReasoning] = useState<string | null>(null)
  const [refinedLoadProjection, setRefinedLoadProjection] = useState<LoadProjection | null>(null)

  // Generate plan on mount
  useEffect(() => {
    if (hasFetched.current || plan) return
    hasFetched.current = true
    generate(weekStart, weekEnd)
  }, [generate, weekStart, weekEnd, plan])

  // React docs idiom: sync local sessions from generated plan during render,
  // gated by plan-identity change so we don't trip the setState-in-effect rule.
  if (plan !== syncedPlan) {
    setSyncedPlan(plan)
    if (plan?.sessions) {
      setSessions(plan.sessions)
    }
  }

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

  // Build session lookup — multiple sessions per day allowed.
  // Sessions binnen een dag worden gesorteerd op tijd.
  const sessionsByDate = new Map<string, PlannedSession[]>()
  for (const s of sessions) {
    const list = sessionsByDate.get(s.date) ?? []
    list.push(s)
    sessionsByDate.set(s.date, list)
  }
  for (const list of sessionsByDate.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time))
  }

  // Handlers — sessies binnen een dag worden geïdentificeerd door (date, time)
  // omdat PlannedSession geen id heeft.
  const handleRemove = useCallback((date: string, time: string) => {
    setSessions((prev) => prev.filter((s) => !(s.date === date && s.time === time)))
    setEditingDate(null)
  }, [])

  const handleStartEdit = useCallback((sessionKey: string) => {
    setEditingDate(sessionKey)
    setAddingDate(null)
  }, [])

  const handleSaveEdit = useCallback((originalDate: string, originalTime: string, updated: PlannedSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.date === originalDate && s.time === originalTime ? updated : s))
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
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={28} className="animate-spin text-[#0A84FF]" />
          <p className="text-sm font-medium text-text-secondary">
            Plan wordt gemaakt...
          </p>
          <p className="text-xs text-text-tertiary">Dit duurt meestal 5-10 seconden</p>
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
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
        <h3 className="text-subhead font-semibold text-text-primary mb-3">Weekplan</h3>

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
                sessions={sessionsByDate.get(date) ?? []}
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

      {/* ACWR load projection (informative — never blocks).
          Prefer the refined projection if the user has chatted with the coach. */}
      {(() => {
        const lp = refinedLoadProjection ?? plan.loadProjection
        if (!lp) return null
        return (
        <div
          className="rounded-2xl border p-4"
          style={{
            background: 'var(--color-bg-surface)',
            borderColor:
              lp.projected.status === 'red'
                ? 'var(--color-status-bad)'
                : lp.projected.status === 'amber'
                  ? 'var(--color-status-warn)'
                  : 'var(--color-bg-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background:
                  lp.projected.status === 'red'
                    ? 'var(--color-status-bad)'
                    : lp.projected.status === 'amber'
                      ? 'var(--color-status-warn)'
                      : 'var(--color-status-good)',
              }}
            />
            <span className="text-sm font-semibold text-text-primary">
              Trainingsbelasting (ACWR)
            </span>
            <span className="ml-auto text-xs tabular-nums text-text-tertiary">
              {lp.current.ratio.toFixed(2)} → {lp.projected.ratio.toFixed(2)}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {lp.message}
          </p>
        </div>
        )
      })()}

      {/* AI reasoning (collapsible). Refined reasoning takes precedence. */}
      {(refinedReasoning ?? plan.reasoning) && (
        <div className="rounded-2xl bg-bg-surface border border-bg-border p-5">
          <button
            onClick={() => setShowReasoning((prev) => !prev)}
            className="flex w-full items-center justify-between"
          >
            <span className="text-xs font-medium text-text-tertiary">
              {refinedReasoning ? 'Coach-aanpassing' : 'AI redenering'}
            </span>
            {showReasoning ? (
              <ChevronUp size={14} className="text-text-tertiary" />
            ) : (
              <ChevronDown size={14} className="text-text-tertiary" />
            )}
          </button>
          {showReasoning && (
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {refinedReasoning ?? plan.reasoning}
            </p>
          )}
        </div>
      )}

      {/* Chat with the coach to adjust the plan */}
      <PlanChat
        weekStart={weekStart}
        weekEnd={weekEnd}
        currentSessions={sessions}
        history={chatHistory}
        onPlanUpdate={(newSessions, reasoning, _conflicts, lp) => {
          setSessions(newSessions)
          setRefinedReasoning(reasoning)
          setRefinedLoadProjection(lp)
          setShowReasoning(true)
          setEditingDate(null)
          setAddingDate(null)
        }}
        onHistoryUpdate={setChatHistory}
      />

      {/* Calendar sync toggle */}
      <div className="rounded-2xl bg-bg-surface border border-bg-border p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={syncToCalendar}
            onChange={(e) => setSyncToCalendar(e.target.checked)}
            className="h-4 w-4 rounded border-bg-border accent-[#0A84FF]"
          />
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-text-tertiary" />
            <span className="text-sm text-text-primary">Sync naar Google Agenda</span>
          </div>
        </label>
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        className="rounded-xl bg-[#0A84FF] px-5 py-2.5 text-sm font-medium text-white"
      >
        Bevestigen en opslaan
      </button>
    </div>
  )
}
