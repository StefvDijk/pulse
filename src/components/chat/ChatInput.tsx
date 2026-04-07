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
      className="flex items-end gap-2 rounded-3xl bg-system-gray6 px-4 py-2 min-h-[44px]"
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
        className="flex-1 resize-none bg-transparent text-body text-label-primary outline-none placeholder:text-label-tertiary py-1.5"
        style={{ maxHeight: '160px' }}
        autoFocus
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-system-blue transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:active:scale-100"
        aria-label="Verstuur bericht"
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Send size={16} color="white" strokeWidth={2} />
        )}
      </button>
    </div>
  )
}
