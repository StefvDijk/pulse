'use client'

import { useState, useCallback } from 'react'
import { SquarePen, Clock } from 'lucide-react'
import { ChatInterface } from './ChatInterface'
import { ChatHistoryPanel } from './ChatHistoryPanel'
import { CoachOrb } from '@/components/shared/CoachOrb'

interface ChatPageProps {
  initialMessage?: string
  seededAssistant?: string
}

export function ChatPage({ initialMessage, seededAssistant }: ChatPageProps) {
  const [sessionKey, setSessionKey] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const handleNewChat = useCallback(() => {
    setActiveSessionId(undefined)
    setSessionKey((k) => k + 1)
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setSessionKey((k) => k + 1)
  }, [])

  return (
    <div className="flex h-[calc(100dvh-var(--nav-height))] flex-col lg:h-screen">
      <header
        className="sticky top-0 z-30 glass-nav border-b-[0.5px] border-bg-border pt-safe pl-safe pr-safe"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.14) 0%, var(--color-bg-glass-nav) 100%)' }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <CoachOrb size={40} />
          <div className="min-w-0 flex-1">
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
          <button
            type="button"
            aria-label="Gesprekshistorie"
            onClick={() => setHistoryOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-all duration-150 hover:text-text-primary active:scale-95"
          >
            <Clock size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Nieuwe chat"
            disabled={isChatLoading}
            onClick={handleNewChat}
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-all duration-150 hover:text-text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <SquarePen size={20} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ChatInterface
          key={sessionKey}
          sessionId={activeSessionId}
          initialMessage={initialMessage}
          seededAssistant={seededAssistant}
          onLoadingChange={setIsChatLoading}
        />
      </div>

      <ChatHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
      />
    </div>
  )
}
