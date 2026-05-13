'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import type { ExerciseListItem } from '@/types/api'

interface ExercisePickerProps {
  exercises: ExerciseListItem[]
  selected: string | null
  onSelect: (name: string) => void
}

export function ExercisePicker({ exercises, selected, onSelect }: ExercisePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = query
    ? exercises.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase()),
      )
    : exercises

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-separator bg-surface-primary px-4 py-3 text-left transition-colors hover:bg-system-gray6"
      >
        <span className={`text-sm ${selected ? 'text-label-primary font-medium' : 'text-label-tertiary'}`}>
          {selected ?? 'Kies een oefening...'}
        </span>
        <ChevronDown
          size={16}
          className={`text-label-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-separator bg-surface-primary shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-separator px-3 py-2">
            <Search size={14} className="text-label-tertiary shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek oefening..."
              className="w-full bg-transparent text-sm text-label-primary placeholder:text-label-tertiary outline-none"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-label-tertiary">Geen resultaten</p>
            ) : (
              filtered.map((exercise) => (
                <button
                  key={exercise.name}
                  onClick={() => {
                    onSelect(exercise.name)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-system-gray6 ${
                    exercise.name === selected ? 'bg-system-gray6' : ''
                  }`}
                >
                  <span className="text-sm text-label-primary">{exercise.name}</span>
                  <span className="text-xs text-label-tertiary">{exercise.primaryMuscleGroup}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
