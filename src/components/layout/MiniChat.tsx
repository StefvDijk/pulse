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
          className="absolute bottom-14 right-0 flex h-[420px] w-[320px] flex-col overflow-hidden rounded-2xl border border-border-light bg-bg-card shadow-2xl"
        >
          {/* Popup header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border-light px-3 py-2">
            <span className="text-sm font-medium text-text-primary">
              Chat
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/chat"
                className="flex items-center gap-1 text-xs text-text-tertiary hover:opacity-80"
                onClick={() => setIsOpen(false)}
              >
                Open volledig
                <ExternalLink size={10} />
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-0.5 text-text-tertiary hover:opacity-70"
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
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent shadow-lg transition-transform hover:scale-105"
        aria-label="Open chat"
      >
        {isOpen ? <X size={20} color="white" /> : <MessageCircle size={20} color="white" />}
      </button>
    </div>
  )
}
