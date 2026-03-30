'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

export interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleInput() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div
      className="flex items-end gap-2 rounded-xl p-3"
      style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Stel een vraag of log een maaltijd..."
        rows={1}
        disabled={isLoading}
        className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-40"
        style={{ color: '#f0f0f5', maxHeight: '160px' }}
        autoFocus
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity disabled:opacity-30"
        style={{ backgroundColor: '#4f8cff' }}
        aria-label="Verstuur bericht"
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Send size={14} color="white" />
        )}
      </button>
    </div>
  )
}
