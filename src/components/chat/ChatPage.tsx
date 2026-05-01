'use client'

import { useState } from 'react'
import { ChatInterface } from './ChatInterface'
import { CoachOrb } from '@/components/shared/CoachOrb'

interface ChatPageProps {
  initialMessage?: string
}

export function ChatPage({ initialMessage }: ChatPageProps) {
  const [sessionKey, setSessionKey] = useState(0)

  function handleNewSession() {
    setSessionKey((k) => k + 1)
  }

  return (
    <div className="flex h-[calc(100dvh-var(--nav-height))] flex-col lg:h-screen">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b-[0.5px] border-bg-border px-4 pt-[60px] pb-3"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.10), transparent)' }}
      >
        <div className="flex items-center gap-3">
          <CoachOrb size={40} />
          <div>
            <div className="text-[18px] font-bold tracking-[-0.3px] text-text-primary">Pulse Coach</div>
            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: '#22D67A' }}>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: '#22D67A', boxShadow: '0 0 8px #22D67A' }}
              />
              Beschikbaar · kent al je data
            </div>
          </div>
        </div>
        <button
          onClick={handleNewSession}
          className="rounded-full border-[0.5px] border-bg-border bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-text-secondary active:opacity-60"
        >
          Nieuwe sessie
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <ChatInterface key={sessionKey} initialMessage={initialMessage} />
      </div>
    </div>
  )
}
