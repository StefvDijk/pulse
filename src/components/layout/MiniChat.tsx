'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle, X, ExternalLink } from 'lucide-react'
import { ChatInterface } from '@/components/chat/ChatInterface'

export function MiniChat() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  return (
    <div ref={containerRef} className="fixed bottom-24 right-4 z-50 lg:bottom-6">
      {/* Popup */}
      {isOpen && (
        <div
          className="absolute bottom-14 right-0 flex flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{
            width: '320px',
            height: '420px',
            backgroundColor: '#0a0a0f',
            border: '1px solid #1a1a2e',
          }}
        >
          {/* Popup header */}
          <div
            className="flex shrink-0 items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid #1a1a2e' }}
          >
            <span className="text-sm font-medium" style={{ color: '#f0f0f5' }}>
              Chat
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/chat"
                className="flex items-center gap-1 text-xs hover:opacity-80"
                style={{ color: '#8888a0' }}
                onClick={() => setIsOpen(false)}
              >
                Open volledig
                <ExternalLink size={10} />
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-0.5 hover:opacity-70"
                style={{ color: '#8888a0' }}
                aria-label="Sluit chat"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Chat interface */}
          <div className="min-h-0 flex-1">
            <ChatInterface compact />
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: '#4f8cff' }}
        aria-label="Open chat"
      >
        {isOpen ? <X size={20} color="white" /> : <MessageCircle size={20} color="white" />}
      </button>
    </div>
  )
}
