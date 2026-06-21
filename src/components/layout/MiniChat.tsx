'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { X, ExternalLink } from 'lucide-react'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { CoachOrb } from '@/components/shared/CoachOrb'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

export function MiniChat() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const manager = getCoachConfig('manager')

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
    <div
      ref={containerRef}
      className="fixed z-50 lg:bottom-6"
      style={{
        bottom: 'calc(var(--nav-height) + 1rem)',
        right: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* Popup */}
      {isOpen && (
        <div
          className="absolute bottom-14 right-0 flex h-[420px] w-[320px] flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-surface shadow-2xl"
        >
          {/* Popup header — the manager's face */}
          <div className="flex shrink-0 items-center justify-between border-b border-bg-border px-3 py-2">
            <span className="flex items-center gap-2">
              <CoachOrb size={22} color={manager.identity.color} />
              <span className="text-sm font-semibold text-text-primary">{manager.identity.name}</span>
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
                className="flex h-11 w-11 items-center justify-center rounded-full text-text-tertiary hover:opacity-70"
                aria-label="Sluit chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Chat interface */}
          <div className="min-h-0 flex-1">
            <ChatInterface compact />
          </div>
        </div>
      )}

      {/* FAB button — the manager's coral CoachOrb */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ background: 'var(--color-bg-elevated)' }}
        aria-label={isOpen ? 'Sluit chat' : 'Open chat'}
      >
        {isOpen ? <X size={20} className="text-text-primary" /> : <CoachOrb size={36} color={manager.identity.color} />}
      </button>
    </div>
  )
}
