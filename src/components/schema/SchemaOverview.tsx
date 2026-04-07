'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, X, Save, Loader2, MessageCircle, Dumbbell } from 'lucide-react'
import Link from 'next/link'
import { SchemaExerciseList } from './SchemaExerciseList'
import type { SchemaScheduleItem, SchemaExercise } from '@/hooks/useSchema'

interface SchemaOverviewProps {
  title: string
  schemaType: string
  schedule: SchemaScheduleItem[]
  onSave: (schedule: SchemaScheduleItem[]) => Promise<void>
}

const TYPE_LABELS: Record<string, string> = {
  upper_lower: 'Upper/Lower',
  push_pull_legs: 'Push/Pull/Legs',
  full_body: 'Full Body',
  custom: 'Custom',
}

export function SchemaOverview({ title, schemaType, schedule, onSave }: SchemaOverviewProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editSchedule, setEditSchedule] = useState<SchemaScheduleItem[]>(schedule)
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null)

  // Only show workouts that have exercises (gym sessions), not running/cardio
  const gymWorkouts = schedule.filter((w) => w.exercises && w.exercises.length > 0)
  const editGymWorkouts = editSchedule.filter((w) => w.exercises && w.exercises.length > 0)

  function handleStartEdit() {
    setEditSchedule(schedule.map((s) => ({ ...s, exercises: s.exercises?.map((e) => ({ ...e })) })))
    setEditing(true)
    setExpanded(true)
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditSchedule(schedule)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Merge edited gym workouts back with unedited non-gym items
      const mergedSchedule = schedule.map((original) => {
        const edited = editSchedule.find((e) => e.focus === original.focus && e.day === original.day)
        return edited ?? original
      })
      await onSave(mergedSchedule)
      setEditing(false)
    } catch {
      // Error is handled by parent
    } finally {
      setSaving(false)
    }
  }

  function handleUpdateExercises(focus: string, exercises: SchemaExercise[]) {
    setEditSchedule((prev) =>
      prev.map((item) => (item.focus === focus ? { ...item, exercises } : item)),
    )
  }

  const typeLabel = TYPE_LABELS[schemaType] ?? schemaType
  const displayWorkouts = editing ? editGymWorkouts : gymWorkouts

  return (
    <div className="rounded-2xl border border-separator bg-surface-primary overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-subhead font-semibold text-label-primary truncate">Mijn Schema</h2>
            <span className="shrink-0 rounded-lg bg-system-blue/10 px-2 py-0.5 text-[11px] font-medium text-system-blue">
              {typeLabel}
            </span>
          </div>
          <p className="text-xs text-label-tertiary mt-1">
            {title} · {gymWorkouts.length} workouts
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`text-label-tertiary transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-separator">
          {/* Action bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-system-gray6/50">
            {editing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-system-blue px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Opslaan
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 rounded-lg border border-separator px-3 py-1.5 text-xs font-medium text-label-secondary hover:bg-system-gray6"
                >
                  <X size={12} />
                  Annuleren
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 rounded-lg border border-separator px-3 py-1.5 text-xs font-medium text-label-secondary hover:bg-system-gray6"
              >
                <Pencil size={12} />
                Bewerken
              </button>
            )}
            <Link
              href="/chat?context=schema"
              className="flex items-center gap-1.5 rounded-lg border border-separator px-3 py-1.5 text-xs font-medium text-label-secondary hover:bg-system-gray6"
            >
              <MessageCircle size={12} />
              Wijzig via Coach
            </Link>
          </div>

          {/* Workout list — just the templates, no day coupling */}
          <div className="divide-y divide-separator">
            {displayWorkouts.map((workout) => {
              const isExpanded = expandedWorkout === workout.focus
              const exerciseCount = workout.exercises?.length ?? 0
              return (
                <div key={workout.focus}>
                  {/* Workout header */}
                  <button
                    onClick={() => setExpandedWorkout(isExpanded ? null : workout.focus)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-system-gray6/30"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-system-blue/10">
                      <Dumbbell size={13} className="text-system-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-label-primary">
                        {workout.focus}
                      </span>
                      {workout.exercises && exerciseCount > 0 && !isExpanded && (
                        <p className="text-xs text-label-tertiary mt-0.5 truncate">
                          {workout.exercises.slice(0, 3).map((e) => e.name).join(', ')}
                          {exerciseCount > 3 && ` +${exerciseCount - 3}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-label-tertiary">
                        {exerciseCount} oefeningen
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-label-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Exercise list */}
                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <SchemaExerciseList
                        exercises={workout.exercises ?? []}
                        editing={editing}
                        onUpdate={(exercises) => handleUpdateExercises(workout.focus, exercises)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
