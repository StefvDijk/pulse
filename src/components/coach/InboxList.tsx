'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Brain, RefreshCcw, X } from 'lucide-react'
import { InboxCard } from './InboxCard'
import { NudgeList } from './NudgeList'
import type { CoachInboxItem } from './types'

interface Props {
  items: CoachInboxItem[]
  isLoading?: boolean
  isError?: boolean
  onClose: () => void
  onMutate: () => void
}

const PRIORITY_ORDER: Record<CoachInboxItem['priority'], number> = { high: 0, medium: 1, low: 2 }

export function InboxList({ items, isLoading = false, isError = false, onClose, onMutate }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const sorted = [...items].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (p !== 0) return p
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-label="Sluit coach-inbox"
      />
      <div
        ref={ref}
        className={[
          'fixed inset-x-3 bottom-[calc(var(--nav-height)+12px)] z-[60]',
          'max-h-[min(70dvh,520px)] overflow-y-auto rounded-[22px]',
          'border border-white/5 bg-[#15171F] p-3 shadow-2xl',
          'lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-12',
          'lg:max-h-[70vh] lg:w-[360px] lg:rounded-[18px]',
        ].join(' ')}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Coach-inbox</h3>
            <Link
              href="/coach/beliefs"
              onClick={onClose}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/75"
            >
              <Brain size={12} strokeWidth={1.8} />
              Hypotheses
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/45 hover:bg-white/5 hover:text-white"
            aria-label="Sluit"
          >
            <X size={18} />
          </button>
        </div>
        {/* Proactive nudges from all coaches land here too (issue #42). */}
        <div className="mb-2 empty:mb-0">
          <NudgeList />
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 px-1 py-4 text-xs text-white/50">
            <RefreshCcw size={14} className="animate-spin" />
            Laden...
          </div>
        ) : isError ? (
          <div className="rounded-[14px] border border-[#FF5E3A]/20 bg-[#FF5E3A]/10 px-3 py-3 text-xs text-[#FFB39F]">
            Coach-inbox kon niet laden.
          </div>
        ) : sorted.length === 0 ? (
          <p className="px-1 py-4 text-xs text-white/50">Geen openstaande coach-vragen.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((item) => (
              <InboxCard key={item.id} item={item} onChanged={onMutate} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
