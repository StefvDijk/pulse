'use client'

import { Plus, GripVertical, Trash2 } from 'lucide-react'
import type { SchemaExercise } from '@/hooks/useSchema'

interface SchemaExerciseListProps {
  exercises: SchemaExercise[]
  editing: boolean
  onUpdate: (exercises: SchemaExercise[]) => void
}

function ViewRow({ exercise }: { exercise: SchemaExercise }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-text-primary truncate flex-1">{exercise.name}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm tabular-nums text-text-secondary">
          {exercise.sets && exercise.reps
            ? `${exercise.sets}×${exercise.reps}`
            : exercise.sets
              ? `${exercise.sets} sets`
              : exercise.reps ?? '—'}
        </span>
      </div>
    </div>
  )
}

interface EditRowProps {
  exercise: SchemaExercise
  index: number
  onUpdate: (index: number, updated: SchemaExercise) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  isFirst: boolean
  isLast: boolean
}

function EditRow({ exercise, index, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: EditRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Reorder buttons */}
      <div className="flex flex-col shrink-0">
        <button
          onClick={() => onMoveUp(index)}
          disabled={isFirst}
          className="text-text-tertiary hover:text-text-primary disabled:opacity-20 p-0.5"
          title="Omhoog"
        >
          <GripVertical size={14} />
        </button>
      </div>

      {/* Name */}
      <input
        type="text"
        value={exercise.name}
        onChange={(e) => onUpdate(index, { ...exercise, name: e.target.value })}
        className="flex-1 min-w-0 rounded-lg border border-bg-border bg-system-gray6 px-2 py-1.5 text-sm text-text-primary outline-none focus:border-system-blue"
        placeholder="Oefening naam"
      />

      {/* Sets */}
      <input
        type="number"
        value={exercise.sets ?? ''}
        onChange={(e) => onUpdate(index, { ...exercise, sets: e.target.value ? Number(e.target.value) : undefined })}
        className="w-14 rounded-lg border border-bg-border bg-system-gray6 px-2 py-1.5 text-sm text-text-primary text-center outline-none focus:border-system-blue"
        placeholder="Sets"
        min={1}
        max={10}
      />

      {/* Reps */}
      <input
        type="text"
        value={exercise.reps ?? ''}
        onChange={(e) => onUpdate(index, { ...exercise, reps: e.target.value || undefined })}
        className="w-16 rounded-lg border border-bg-border bg-system-gray6 px-2 py-1.5 text-sm text-text-primary text-center outline-none focus:border-system-blue"
        placeholder="Reps"
      />

      {/* Delete */}
      <button
        onClick={() => onRemove(index)}
        className="shrink-0 p-1.5 text-text-tertiary hover:text-system-red rounded-lg hover:bg-system-red/10"
        title="Verwijderen"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function SchemaExerciseList({ exercises, editing, onUpdate }: SchemaExerciseListProps) {
  function handleUpdateExercise(index: number, updated: SchemaExercise) {
    onUpdate(exercises.map((e, i) => (i === index ? updated : e)))
  }

  function handleRemove(index: number) {
    onUpdate(exercises.filter((_, i) => i !== index))
  }

  function handleAdd() {
    onUpdate([...exercises, { name: '', sets: 3, reps: '10' }])
  }

  function handleMoveUp(index: number) {
    if (index === 0) return
    const next = [...exercises]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    onUpdate(next)
  }

  function handleMoveDown(index: number) {
    if (index === exercises.length - 1) return
    const next = [...exercises]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    onUpdate(next)
  }

  if (!editing) {
    if (exercises.length === 0) {
      return (
        <p className="text-xs text-text-tertiary py-2">
          Geen oefeningen gedefinieerd — klik <span className="font-medium">Bewerken</span> om toe te voegen
        </p>
      )
    }
    return (
      <div className="divide-y divide-separator">
        {exercises.map((exercise, i) => (
          <ViewRow key={`${exercise.name}-${i}`} exercise={exercise} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Header labels — only show when there are exercises */}
      {exercises.length > 0 && (
        <div className="flex items-center gap-2 px-1 pb-1">
          <span className="w-5" />
          <span className="flex-1 text-[11px] font-medium text-text-tertiary uppercase">Oefening</span>
          <span className="w-14 text-[11px] font-medium text-text-tertiary uppercase text-center">Sets</span>
          <span className="w-16 text-[11px] font-medium text-text-tertiary uppercase text-center">Reps</span>
          <span className="w-8" />
        </div>
      )}

      {exercises.map((exercise, i) => (
        <EditRow
          key={`edit-${i}`}
          exercise={exercise}
          index={i}
          onUpdate={handleUpdateExercise}
          onRemove={handleRemove}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          isFirst={i === 0}
          isLast={i === exercises.length - 1}
        />
      ))}

      <button
        onClick={handleAdd}
        className="flex items-center gap-1.5 mt-1 rounded-lg border border-dashed border-bg-border px-3 py-2 text-xs font-medium text-text-tertiary hover:text-text-secondary hover:border-bg-border hover:bg-system-gray6/50"
      >
        <Plus size={14} />
        Oefening toevoegen
      </button>
    </div>
  )
}
