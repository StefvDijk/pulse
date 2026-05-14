'use client'

import { useState } from 'react'
import { ChatInterface } from './ChatInterface'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { Button } from '@/components/ui'

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
      {/* Header — NavBar with CoachOrb leading slot */}
      {/* Coach header — custom wrapper keeps the purple-tint gradient while
          using NavBar's glass-nav backdrop and sticky positioning */}
      <header
        className="sticky top-0 z-30 glass-nav border-b-[0.5px] border-bg-border pt-safe pl-safe pr-safe"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.14) 0%, var(--color-bg-glass-nav) 100%)' }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          {/* Leading: CoachOrb + text */}
          <CoachOrb size={40} />
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold leading-[22px] tracking-[-0.3px] text-text-primary">
              Pulse Coach
            </div>
            <div className="flex items-center gap-1.5 text-body-s text-status-good">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-good"
                style={{ boxShadow: '0 0 8px var(--color-status-good)' }}
              />
              Beschikbaar · kent al je data
            </div>
          </div>
          {/* Trailing: new session */}
          <Button
            variant="glass"
            size="sm"
            onClick={handleNewSession}
          >
            Nieuwe sessie
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ChatInterface key={sessionKey} initialMessage={initialMessage} />
      </div>
    </div>
  )
}
