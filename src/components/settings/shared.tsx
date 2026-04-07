'use client'

import { useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useSaveStatus(): [SaveStatus, (fn: () => Promise<void>) => void] {
  const [status, setStatus] = useState<SaveStatus>('idle')

  const save = (fn: () => Promise<void>) => {
    setStatus('saving')
    fn()
      .then(() => {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2000)
      })
      .catch(() => setStatus('error'))
  }

  return [status, save]
}

export function SaveButton({ status, onClick }: { status: SaveStatus; onClick: () => void }) {
  const label = status === 'saving' ? 'Opslaan…' : status === 'saved' ? 'Opgeslagen ✓' : 'Opslaan'
  return (
    <button
      onClick={onClick}
      disabled={status === 'saving'}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${
        status === 'saved' ? 'bg-system-green text-white' : 'bg-system-blue text-white'
      }`}
    >
      {label}
    </button>
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
