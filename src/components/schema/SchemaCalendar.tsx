'use client'

import { useState } from 'react'
import { Check, Dumbbell, Footprints, CircleDot, ChevronLeft, ChevronRight, MoreHorizontal, ArrowRight, Calendar, Pencil } from 'lucide-react'
import type { SchemaWeek, SchemaDay, SchemaScheduleItem } from '@/hooks/useSchema'
import { EditWeekModal } from './EditWeekModal'
import { DayDetailSheet } from './DayDetailSheet'
import { formatShortNumeric, formatDateRange } from '@/lib/formatters'
import type { SportType } from '@/lib/constants'

interface SchemaCalendarProps {
  weeks: SchemaWeek[]
  currentWeek: number
  calendarConnected: boolean
  templateSchedule: SchemaScheduleItem[]
  onReschedule: (fromDate: string, toDate: string, workoutFocus: string) => Promise<void>
  onPushToCalendar: () => void
  onSchemaChanged: () => void
}

const DAY_HEADERS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'] as const

function classifySport(focus: string | null): SportType {
  if (!focus) return 'unknown'
  const t = focus.toLowerCase()
  if (t.includes('upper') || t.includes('lower')) return 'gym'
  if (t.includes('hardlopen') || t.includes('run')) return 'run'
  if (t.includes('padel')) return 'padel'
  if (t.includes('bodyweight') || t.includes('circuit')) return 'gym'
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
    case 'run': return 'bg-system-orange'
    case 'padel': return 'bg-system-yellow'
    default: return 'bg-system-blue'
  }
}

function sportLightClass(sport: SportType): string {
  switch (sport) {
    case 'run': return 'bg-system-orange/10'
    case 'padel': return 'bg-system-yellow/10'
    default: return 'bg-system-blue/10'
  }
}

function sportTextClass(sport: SportType): string {
  switch (sport) {
    case 'run': return 'text-system-orange'
    case 'padel': return 'text-system-yellow'
    default: return 'text-system-blue'
  }
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
      <div className="relative w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-surface-primary shadow-2xl">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-label-primary">
            {day.workoutFocus} verplaatsen
          </h3>
          <p className="text-xs text-label-tertiary mt-0.5">Kies een nieuwe dag</p>
        </div>
        <div className="flex flex-col gap-1 px-3 pb-4">
          {availableDays.map((target) => (
            <button
              key={target.date}
              onClick={() => onMove(target.date)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-system-gray6 transition-colors"
            >
              <ArrowRight size={14} className="text-label-tertiary" />
              <span className="text-sm text-label-primary">
                {DAY_HEADERS[new Date(target.date + 'T00:00:00Z').getUTCDay() === 0 ? 6 : new Date(target.date + 'T00:00:00Z').getUTCDay() - 1]}
              </span>
              <span className="text-xs text-label-tertiary">{formatShortNumeric(target.date)}</span>
              {target.workoutFocus && (
                <span className="ml-auto text-xs text-label-tertiary">
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
  onOpenDetail: () => void
}

function DayCell({ day, isCurrentWeek, onOpenMenu, onOpenDetail }: DayCellProps) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  const isToday = day.date === today
  const isPast = day.date < today
  const dateNum = new Date(day.date + 'T00:00:00Z').getUTCDate()

  if (day.status === 'rest' || !day.workoutFocus) {
    return (
      <div className={`flex flex-col items-center gap-1 py-2 ${isPast && !isCurrentWeek ? 'opacity-40' : 'opacity-60'}`}>
        <span className="text-[11px] text-label-tertiary tabular-nums">{dateNum}</span>
        <span className="text-[10px] text-label-tertiary">—</span>
      </div>
    )
  }

  const sport = classifySport(day.workoutFocus)

  return (
    <div
      onClick={onOpenDetail}
      className={`flex flex-col items-center gap-1 rounded-xl py-2 px-1 transition-colors cursor-pointer ${
        isToday
          ? 'bg-text-primary/5 ring-1 ring-text-primary'
          : day.status === 'completed'
            ? sportLightClass(sport)
            : 'hover:bg-system-gray6'
      } ${isPast && day.status !== 'completed' && !isCurrentWeek ? 'opacity-50' : ''}`}
    >
      <span className={`text-[11px] tabular-nums ${isToday ? 'font-bold text-label-primary' : 'text-label-tertiary'}`}>
        {dateNum}
      </span>
      {day.status === 'completed' ? (
        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${sportColorClass(sport)}`}>
          <Check size={10} strokeWidth={3} className="text-white" />
        </div>
      ) : (
        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${
          isToday ? 'bg-text-primary' : 'border border-separator'
        }`}>
          <SportIcon sport={sport} size={9} className={isToday ? 'text-white' : 'text-label-tertiary'} />
        </div>
      )}
      <span className={`text-[9px] font-medium leading-tight text-center max-w-full truncate ${
        day.status === 'completed' ? sportTextClass(sport) : isToday ? 'text-label-primary' : 'text-label-secondary'
      }`}>
        {day.workoutFocus}
      </span>
      {day.status !== 'completed' && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenMenu() }}
          className="mt-0.5 p-0.5 rounded hover:bg-system-gray6"
        >
          <MoreHorizontal size={10} className="text-label-tertiary" />
        </button>
      )}
    </div>
  )
}

/* ── Main Calendar ───────────────────────────────────────── */

export function SchemaCalendar({
  weeks,
  currentWeek,
  calendarConnected,
  templateSchedule,
  onReschedule,
  onPushToCalendar,
  onSchemaChanged,
}: SchemaCalendarProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const [rescheduleDay, setRescheduleDay] = useState<SchemaDay | null>(null)
  const [detailDay, setDetailDay] = useState<SchemaDay | null>(null)
  const [moving, setMoving] = useState(false)
  const [editingWeek, setEditingWeek] = useState(false)

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
    <div className="rounded-2xl border border-separator bg-surface-primary overflow-hidden">
      {/* Week selector header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-separator">
        <button
          onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
          disabled={selectedWeek <= 1}
          className="p-1 rounded-lg text-label-tertiary hover:bg-system-gray6 disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-center">
          <h3 className="text-sm font-semibold text-label-primary">
            Week {selectedWeek}
            {selectedWeek === currentWeek && (
              <span className="ml-1.5 text-[10px] font-normal text-system-blue">(huidige)</span>
            )}
          </h3>
          <p className="text-[11px] text-label-tertiary mt-0.5">
            {formatDateRange(week.days[0].date, week.days[6].date, { utc: true })}
            {' · '}
            {week.sessionsCompleted}/{week.sessionsPlanned} sessies
          </p>
          <button
            onClick={() => setEditingWeek(true)}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-system-gray6 px-2.5 py-0.5 text-[10px] font-medium text-label-secondary hover:bg-system-gray5"
          >
            <Pencil size={10} />
            Aanpassen
          </button>
        </div>

        <button
          onClick={() => setSelectedWeek((w) => Math.min(weeks.length, w + 1))}
          disabled={selectedWeek >= weeks.length}
          className="p-1 rounded-lg text-label-tertiary hover:bg-system-gray6 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-separator">
        {DAY_HEADERS.map((label) => (
          <div key={label} className="py-1.5 text-center text-[10px] font-medium text-label-tertiary uppercase">
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
            onOpenDetail={() => setDetailDay(day)}
          />
        ))}
      </div>

      {/* Week dots navigation */}
      <div className="flex items-center justify-center gap-1.5 py-3 border-t border-separator">
        {weeks.map((w) => (
          <button
            key={w.weekNumber}
            onClick={() => setSelectedWeek(w.weekNumber)}
            className={`h-2 rounded-full transition-all ${
              w.weekNumber === selectedWeek
                ? 'w-4 bg-system-blue'
                : w.isComplete
                  ? 'w-2 bg-system-blue/40'
                  : 'w-2 bg-system-gray6'
            }`}
          />
        ))}
      </div>

      {/* Push to calendar button */}
      {calendarConnected && (
        <div className="border-t border-separator px-4 py-3">
          <button
            onClick={onPushToCalendar}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-system-blue px-4 py-2.5 text-sm font-medium text-white"
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

      {/* Day detail sheet */}
      {detailDay && detailDay.workoutFocus && (
        <DayDetailSheet
          day={detailDay}
          onClose={() => setDetailDay(null)}
        />
      )}

      {/* Edit-week modal */}
      {editingWeek && (
        <EditWeekModal
          weekNumber={selectedWeek}
          days={week.days}
          templateSchedule={templateSchedule}
          onClose={() => setEditingWeek(false)}
          onSaved={onSchemaChanged}
        />
      )}
    </div>
  )
}
