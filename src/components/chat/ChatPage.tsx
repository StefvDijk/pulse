'use client'

import { useState } from 'react'
import { ChatInterface } from './ChatInterface'

interface ChatPageProps {
  initialMessage?: string
}

export function ChatPage({ initialMessage }: ChatPageProps) {
  const [sessionKey, setSessionKey] = useState(0)

  function handleNewSession() {
    setSessionKey((k) => k + 1)
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:h-screen">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-separator px-4 py-3">
        <h1 className="text-lg font-semibold text-label-primary">
          Coach
        </h1>
        <button
          onClick={handleNewSession}
          className="rounded-lg border border-separator bg-system-gray6 px-3 py-1.5 text-xs text-label-secondary transition-colors hover:bg-system-gray5"
        >
          Nieuwe sessie
        </button>
      </div>

      {/* Chat interface fills remaining height */}
      <div className="min-h-0 flex-1">
        <ChatInterface key={sessionKey} initialMessage={initialMessage} />
      </div>
    </div>
  )
}
