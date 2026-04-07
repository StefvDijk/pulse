'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useCoachingMemory, type CoachingMemoryEntry } from '@/hooks/useCoachingMemory'
import { SectionHeader, INPUT_CLASSES } from './shared'

const CATEGORY_LABELS: Record<string, string> = {
  program: 'Programma',
  lifestyle: 'Leefstijl',
  injury: 'Blessures',
  preference: 'Voorkeuren',
  pattern: 'Patronen',
  goal: 'Doelen',
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

function groupByCategory(memories: CoachingMemoryEntry[]): Record<string, CoachingMemoryEntry[]> {
  const groups: Record<string, CoachingMemoryEntry[]> = {}
  for (const m of memories) {
    const cat = m.category
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(m)
  }
  return groups
}

function MemoryItem({
  memory,
  onUpdate,
  onDelete,
}: {
  memory: CoachingMemoryEntry
  onUpdate: (id: string, value: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(memory.value)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(memory.id, editValue)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await onDelete(memory.id)
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-system-gray6 p-3">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, 500))}
          rows={2}
          className={`${INPUT_CLASSES} w-full resize-none`}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-label-tertiary">{editValue.length}/500</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setEditValue(memory.value) }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-label-secondary hover:bg-system-gray6"
            >
              <X size={12} /> Annuleer
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editValue.trim()}
              className="flex items-center gap-1 rounded-lg bg-system-blue px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              <Check size={12} /> Opslaan
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2 rounded-lg px-3 py-2 hover:bg-system-gray6">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-label-primary">{memory.value}</p>
        <p className="mt-0.5 text-xs text-label-tertiary">
          {memory.key} &middot; {memory.source_date}
        </p>
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirming ? (
          <>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="rounded p-1 text-system-red hover:bg-system-red/10 disabled:opacity-50"
              title="Bevestig verwijderen"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded p-1 text-label-tertiary hover:bg-system-gray6"
              title="Annuleer"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { setEditing(true); setEditValue(memory.value) }}
              className="rounded p-1 text-label-tertiary hover:bg-system-gray6 hover:text-label-primary"
              title="Bewerk"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded p-1 text-label-tertiary hover:bg-system-gray6 hover:text-system-red"
              title="Verwijder"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CategoryGroup({
  category,
  memories,
  onUpdate,
  onDelete,
}: {
  category: string
  memories: CoachingMemoryEntry[]
  onUpdate: (id: string, value: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-label-tertiary hover:text-label-secondary"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {getCategoryLabel(category)}
        <span className="font-normal">({memories.length})</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1">
          {memories.map((m) => (
            <MemoryItem key={m.id} memory={m} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

export function CoachingMemoryEditor() {
  const { memories, isLoading, updateMemory, deleteMemory } = useCoachingMemory()
  const groups = groupByCategory(memories)
  const categoryOrder = Object.keys(CATEGORY_LABELS)
  const sortedCategories = [
    ...categoryOrder.filter((c) => groups[c]),
    ...Object.keys(groups).filter((c) => !categoryOrder.includes(c)),
  ]

  return (
    <div className="bg-surface-primary border border-separator rounded-[14px] p-[14px_16px]">
      <SectionHeader title="Coaching Geheugen" />
      <p className="mb-3 text-xs text-label-tertiary">
        Feiten die de AI coach heeft onthouden uit jullie gesprekken.
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-system-gray6" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <p className="py-4 text-center text-sm text-label-tertiary">
          Nog geen herinneringen. Chat met je coach om het geheugen te vullen.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedCategories.map((cat) => (
            <CategoryGroup
              key={cat}
              category={cat}
              memories={groups[cat]}
              onUpdate={updateMemory}
              onDelete={deleteMemory}
            />
          ))}
        </div>
      )}
    </div>
  )
}
