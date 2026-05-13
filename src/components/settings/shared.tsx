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

  const buttonBg =
    status === 'saved'
      ? 'bg-[var(--color-status-good)] text-black'
      : status === 'error'
        ? 'bg-system-red text-white'
        : 'bg-[#0A84FF] text-white'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={status === 'saving'}
        className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity disabled:opacity-50 ${buttonBg}`}
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
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">{title}</h2>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-text-tertiary">{label}</label>
      {children}
    </div>
  )
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <div
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{
        background: active ? '#22D67A' : 'rgba(255,255,255,0.16)',
        boxShadow: active ? '0 0 8px #22D67A' : undefined,
      }}
      title={active ? 'Verbonden' : 'Niet verbonden'}
    />
  )
}

export const INPUT_CLASSES = 'bg-white/[0.06] border-[0.5px] border-bg-border text-text-primary rounded-[10px] px-3 py-2 text-[16px] outline-none focus:border-bg-border-strong focus-ring'
