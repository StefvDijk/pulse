'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CoachOrb } from '@/components/shared/CoachOrb'

const STORAGE_PREFIX = 'pulse:coachCard:collapsed:'

export interface CoachCardProps {
  /** Stable identifier for this signal. When it changes, the collapsed state
   *  resets so a new signal is shown expanded by default. */
  signalId: string
  /** Coach message body. Shown in the card and used as the chat seed. */
  text: string
}

export function CoachCard({ signalId, text }: CoachCardProps) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_PREFIX + signalId)
    setCollapsed(stored === '1')
  }, [signalId])

  const persist = useCallback(
    (next: boolean) => {
      setCollapsed(next)
      if (typeof window === 'undefined') return
      const key = STORAGE_PREFIX + signalId
      if (next) {
        window.localStorage.setItem(key, '1')
      } else {
        window.localStorage.removeItem(key)
      }
    },
    [signalId],
  )

  const openChat = useCallback(() => {
    router.push(`/chat?seed=${encodeURIComponent(text)}`)
  }, [router, text])

  const gradient =
    'linear-gradient(135deg, rgba(10,132,255,0.10), rgba(124,58,237,0.06))'

  if (collapsed) {
    const preview = text.length > 48 ? text.slice(0, 46).trimEnd() + '…' : text
    return (
      <button
        type="button"
        onClick={() => persist(false)}
        aria-expanded="false"
        aria-label="Toon coach-melding"
        className="flex w-full items-center gap-2.5 rounded-card-lg border-[0.5px] border-white/[0.10] px-4 py-2.5 active:opacity-80"
        style={{ background: gradient }}
      >
        <CoachOrb size={22} />
        <span className="truncate text-[12px] font-medium text-text-secondary">
          {preview}
        </span>
        <span
          className="ml-auto text-[18px] leading-none text-text-tertiary"
          aria-hidden="true"
        >
          ›
        </span>
      </button>
    )
  }

  return (
    <div
      className="relative overflow-hidden rounded-card-lg border-[0.5px] border-white/[0.10]"
      style={{ background: gradient }}
    >
      <button
        type="button"
        onClick={openChat}
        aria-label="Bespreek met de coach"
        className="block w-full p-4 pr-12 text-left active:opacity-80"
      >
        <div className="flex items-center gap-2.5">
          <CoachOrb size={28} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-text-secondary">
            Coach
          </span>
          <span
            className="ml-auto text-[18px] leading-none text-text-tertiary"
            aria-hidden="true"
          >
            ›
          </span>
        </div>
        <p className="mt-2.5 text-[14px] leading-[1.45] text-text-primary">{text}</p>
      </button>
      <button
        type="button"
        onClick={() => persist(true)}
        aria-label="Inklappen"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:text-text-secondary"
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>
  )
}
