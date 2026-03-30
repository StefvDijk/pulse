'use client'

import { useState } from 'react'
import { ChatInterface } from './ChatInterface'

export function ChatPage() {
  const [sessionKey, setSessionKey] = useState(0)

  function handleNewSession() {
    setSessionKey((k) => k + 1)
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:h-screen">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #1a1a2e' }}
      >
        <h1 className="text-lg font-semibold" style={{ color: '#f0f0f5' }}>
          Chat
        </h1>
        <button
          onClick={handleNewSession}
          className="rounded-lg px-3 py-1.5 text-xs transition-colors hover:opacity-80"
          style={{ backgroundColor: '#1a1a2e', color: '#8888a0', border: '1px solid #3a3a5c' }}
        >
          Nieuwe sessie
        </button>
      </div>

      {/* Chat interface fills remaining height */}
      <div className="min-h-0 flex-1">
        <ChatInterface key={sessionKey} />
      </div>
    </div>
  )
}
