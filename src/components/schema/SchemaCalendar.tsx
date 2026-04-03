'use client'

import { useState } from 'react'
import { Check, Dumbbell, Footprints, CircleDot, ChevronLeft, ChevronRight, MoreHorizontal, ArrowRight, Calendar } from 'lucide-react'
import type { SchemaWeek, SchemaDay } from '@/hooks/useSchema'

interface SchemaCalendarProps {
  weeks: SchemaWeek[]
  currentWeek: number
  calendarConnected: boolean
  onReschedule: (fromDate: string, toDate: string, workoutFocus: string) => Promise<void>
  onPushToCalendar: () => void
}

const DAY_HEADERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'] as const

type SportType = 'gym' | 'run' | 'padel' | 'unknown'

function classifySport(focus: string | null): SportType {
  if (!focus) return 'unknown'
  const t = focus.toLowerCase()
  if (t.includes('upper') || t.includes('lower')) return 'gym'
  if (t.includes('hardlopen') || t.includes('run')) return 'run'
  if (t.includes('padel')) return 'padel'
  return 'gym'
}

function SportIcon({ sport, size = 9, className }: { sport: SportType; size?: number; className?: string }) {
  switch (sport) {
    case 'run':
      return <Footprints size={size} className={className} />
    case 'padel':
      return <CircleDot size={size} className={className} />
    default:
      return <Dumbbell size={size} className={className} />
  }
}

function sportColorClass(sport: SportType): string {
  switch (sport) {
    case 'run': return 'bg-sport-run'
    case 'padel': return 'bg-sport-padel'
    default: return 'bg-sport-gym'
  }
}

function sportLightClass(sport: SportType): string {
  switch (sport) {
    case 'run': return 'bg-sport-run-light'
    case 'padel': return 'bg-sport-padel-light'
    default: return 'bg-sport-gym-light'
  }
}

function sportTextClass(sport: SportType): string {
  switch (sport) {
    case 'run': return 'text-sport-run'
    case 'padel': return 'text-sport-padel'
    default: return 'text-sport-gym'
  }
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

function formatDateRange(days: SchemaDay[]): string {
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const first = new Date(days[0].date + 'T00:00:00Z')
  const last = new Date(days[6].date + 'T00:00:00Z')
  return `${first.getUTCDate()} ${months[first.getUTCMonth()]} – ${last.getUTCDate()} ${months[last.getUTCMonth()]}`
}

/* ── Reschedule Menu ─────────────────────────────────────── */

interface RescheduleMenuProps {
  day: SchemaDay
  weekDays: SchemaDay[]
  onMove: (toDate: string) => void
  onClose: () => void
}

function RescheduleMenu({ day, weekDays, onMove, onClose }: RescheduleMenuProps) {
  const availableDays = weekDays.filter(
    (d) => d.date !== day.date && d.status !== 'completed',
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-bg-card shadow-2xl">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {day.workoutFocus} verplaatsen
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">Kies een nieuwe dag</p>
        </div>
        <div className="flex flex-col gap-1 px-3 pb-4">
          {availableDays.map((target) => (
            <button
              key={target.date}
              onClick={() => onMove(target.date)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-bg-subtle transition-colors"
            >
              <ArrowRight size={14} className="text-text-tertiary" />
              <span className="text-sm text-text-primary">
                {DAY_HEADERS[new Date(target.date + 'T00:00:00Z').getUTCDay() === 0 ? 6 : new Date(target.date + 'T00:00:00Z').getUTCDay() - 1]}
              </span>
              <span className="text-xs text-text-tertiary">{formatDateShort(target.date)}</span>
              {target.workoutFocus && (
                <span className="ml-auto text-xs text-text-tertiary">
                  ({target.workoutFocus})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Day Cell ────────────────────────────────────────────── */

interface DayCellProps {
  day: SchemaDay
  isCurrentWeek: boolean
  onOpenMenu: () => void
}

function DayCell({ day, isCurrentWeek, onOpenMenu }: DayCellProps) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  const isToday = day.date === today
  const isPast = day.date < today
  const dateNum = new Date(day.date + 'T00:00:00Z').getUTCDate()

  if (day.status === 'rest' || !day.workoutFocus) {
    return (
      <div className={`flex flex-col items-center gap-1 py-2 ${isPast && !isCurrentWeek ? 'opacity-40' : 'opacity-60'}`}>
        <span className="text-[11px] text-text-tertiary tabular-nums">{dateNum}</span>
        <span className="text-[10px] text-text-tertiary">—</span>
      </div>
    )
  }

  const sport = classifySport(day.workoutFocus)

  return (
    <button
      onClick={day.status !== 'completed' ? onOpenMenu : undefined}
      className={`flex flex-col items-center gap-1 rounded-xl py-2 px-1 transition-colors ${
        isToday
          ? 'bg-text-primary/5 ring-1 ring-text-primary'
          : day.status === 'completed'
            ? sportLightClass(sport)
            : 'hover:bg-bg-subtle'
      } ${isPast && day.status !== 'completed' && !isCurrentWeek ? 'opacity-50' : ''}`}
    >
      <span className={`text-[11px] tabular-nums ${isToday ? 'font-bold text-text-primary' : 'text-text-tertiary'}`}>
        {dateNum}
      </span>
      {day.status === 'completed' ? (
        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${sportColorClass(sport)}`}>
          <Check size={10} strokeWidth={3} className="text-white" />
        </div>
      ) : (
        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${
          isToday ? 'bg-text-primary' : 'border border-border-medium'
        }`}>
          <SportIcon sport={sport} size={9} className={isToday ? 'text-white' : 'text-text-tertiary'} />
        </div>
      )}
      <span className={`text-[9px] font-medium leading-tight text-center max-w-full truncate ${
        day.status === 'completed' ? sportTextClass(sport) : isToday ? 'text-text-primary' : 'text-text-secondary'
      }`}>
        {day.workoutFocus}
      </span>
      {day.status !== 'completed' && (
        <MoreHorizontal size={10} className="text-text-tertiary mt-0.5" />
      )}
    </button>
  )
}

/* ── Main Calendar ───────────────────────────────────────── */

export function SchemaCalendar({
  weeks,
  currentWeek,
  calendarConnected,
  onReschedule,
  onPushToCalendar,
}: SchemaCalendarProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const [rescheduleDay, setRescheduleDay] = useState<SchemaDay | null>(null)
  const [moving, setMoving] = useState(false)

  const week = weeks[selectedWeek - 1]
  if (!week) return null

  async function handleMove(toDate: string) {
    if (!rescheduleDay?.workoutFocus) return
    setMoving(true)
    try {
      await onReschedule(rescheduleDay.date, toDate, rescheduleDay.workoutFocus)
      setRescheduleDay(null)
    } catch {
      // Parent handles error
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border-light bg-bg-card overflow-hidden">
      {/* Week selector header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
        <button
          onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
          disabled={selectedWeek <= 1}
          className="p-1 rounded-lg text-text-tertiary hover:bg-bg-subtle disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-center">
          <h3 className="text-sm font-semibold text-text-primary">
            Week {selectedWeek}
            {selectedWeek === currentWeek && (
              <span className="ml-1.5 text-[10px] font-normal text-sport-gym">(huidige)</span>
            )}
          </h3>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {formatDateRange(week.days)}
            {' · '}
            {week.sessionsCompleted}/{week.sessionsPlanned} sessies
          </p>
        </div>

        <button
          onClick={() => setSelectedWeek((w) => Math.min(weeks.length, w + 1))}
          disabled={selectedWeek >= weeks.length}
          className="p-1 rounded-lg text-text-tertiary hover:bg-bg-subtle disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-light">
        {DAY_HEADERS.map((label) => (
          <div key={label} className="py-1.5 text-center text-[10px] font-medium text-text-tertiary uppercase">
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-border-light/50 p-2">
        {week.days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            isCurrentWeek={selectedWeek === currentWeek}
            onOpenMenu={() => setRescheduleDay(day)}
          />
        ))}
      </div>

      {/* Week dots navigation */}
      <div className="flex items-center justify-center gap-1.5 py-3 border-t border-border-light">
        {weeks.map((w) => (
          <button
            key={w.weekNumber}
            onClick={() => setSelectedWeek(w.weekNumber)}
            className={`h-2 rounded-full transition-all ${
              w.weekNumber === selectedWeek
                ? 'w-4 bg-sport-gym'
                : w.isComplete
                  ? 'w-2 bg-sport-gym/40'
                  : 'w-2 bg-bg-subtle'
            }`}
          />
        ))}
      </div>

      {/* Push to calendar button */}
      {calendarConnected && (
        <div className="border-t border-border-light px-4 py-3">
          <button
            onClick={onPushToCalendar}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-text"
          >
            <Calendar size={14} />
            Week {selectedWeek} inplannen in agenda
          </button>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleDay && !moving && (
        <RescheduleMenu
          day={rescheduleDay}
          weekDays={week.days}
          onMove={handleMove}
          onClose={() => setRescheduleDay(null)}
        />
      )}
    </div>
  )
}
