'use client'

import { useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveState {
  status: SaveStatus
  errorMessage: string | null
}

export function useSaveStatus(): [SaveState, (fn: () => Promise<void>) => void] {
  const [state, setState] = useState<SaveState>({ status: 'idle', errorMessage: null })

  const save = (fn: () => Promise<void>) => {
    setState({ status: 'saving', errorMessage: null })
    fn()
      .then(() => {
        setState({ status: 'saved', errorMessage: null })
        setTimeout(() => setState({ status: 'idle', errorMessage: null }), 2000)
      })
      .catch((err) => {
        const message =
          err instanceof Error && err.message ? err.message : 'Opslaan mislukt. Probeer opnieuw.'
        setState({ status: 'error', errorMessage: message })
      })
  }

  return [state, save]
}

interface SaveButtonProps {
  state: SaveState
  onClick: () => void
}

export function SaveButton({ state, onClick }: SaveButtonProps) {
  const { status, errorMessage } = state

  const label =
    status === 'saving'
      ? 'Opslaan…'
      : status === 'saved'
        ? 'Opgeslagen ✓'
        : status === 'error'
          ? 'Opnieuw proberen'
          : 'Opslaan'

  const bg =
    status === 'saved'
      ? 'bg-system-green text-white'
      : status === 'error'
        ? 'bg-system-red text-white'
        : 'bg-system-blue text-white'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={status === 'saving'}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${bg}`}
      >
        {label}
      </button>
      {status === 'error' && errorMessage && (
        <p
          role="alert"
          className="max-w-[240px] text-right text-xs text-system-red"
        >
          {errorMessage}
        </p>
      )}
    </div>
  )
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-4 text-base font-semibold text-label-primary">{title}</h2>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-label-tertiary">{label}</label>
      {children}
    </div>
  )
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <div
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: active ? '#16A34A' : '#D6D3CD' }}
      title={active ? 'Verbonden' : 'Niet verbonden'}
    />
  )
}

export const INPUT_CLASSES = 'bg-system-gray6 border border-separator text-label-primary rounded-[10px] px-3 py-2 text-sm outline-none'
