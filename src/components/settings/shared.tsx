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
      className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-opacity disabled:opacity-50 ${
        status === 'saved' ? 'bg-[var(--color-status-good)] text-black' : 'bg-[#0A84FF] text-white'
      }`}
    >
      {label}
    </button>
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
