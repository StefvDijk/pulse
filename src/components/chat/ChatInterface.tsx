'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ChatSuggestions } from './ChatSuggestions'
import { SkeletonCard, SkeletonLine } from '@/components/shared/Skeleton'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatHistoryResponse {
  session_id: string | null
  messages: Array<{
    id: string
    role: string
    content: string
    created_at: string | null
  }>
}

export interface ChatInterfaceProps {
  sessionId?: string
  compact?: boolean
  initialMessage?: string
}

const NEAR_BOTTOM_PX = 120

export function ChatInterface({ sessionId: initialSessionId, compact = false, initialMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [isInitializing, setIsInitializing] = useState(true)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const initialMessageSentRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // Load history on mount
  useEffect(() => {
    const url = sessionId
      ? `/api/chat/history?session_id=${sessionId}`
      : '/api/chat/history'

    fetch(url)
      .then((r) => r.json() as Promise<ChatHistoryResponse>)
      .then((data) => {
        if (data.session_id) setSessionId(data.session_id)
        setMessages(
          (data.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        )
        if (data.messages && data.messages.length > 0) {
          setShowSuggestions(false)
        }
      })
      .catch((err: unknown) => {
        console.error('[ChatInterface] Failed to load history:', err)
      })
      .finally(() => setIsInitializing(false))
  }, [sessionId])

  // Smooth scroll only when a new message arrives — not on every streamed token.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  // Follow the stream while a message is being typed, but only if the user is
  // already near the bottom — never yank them away from content they're reading.
  // rAF-throttled so we render at most once per frame instead of once per token.
  useEffect(() => {
    if (!streamingContent) return
    const container = scrollContainerRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom > NEAR_BOTTOM_PX) return

    if (rafRef.current !== null) return // already scheduled this frame
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      bottomRef.current?.scrollIntoView({ block: 'end' })
    })
  }, [streamingContent])

  // Cancel any pending rAF on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleSend = useCallback(
    async (message: string) => {
      if (isLoading) return

      setShowSuggestions(false)
      setIsLoading(true)
      setLastFailedMessage(null)

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
      }
      setMessages((prev) => [...prev, userMsg])
      setStreamingContent('')

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, session_id: sessionId }),
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        // Capture session id from header
        const newSessionId = res.headers.get('X-Session-Id')
        if (newSessionId) setSessionId(newSessionId)

        if (!res.body) {
          throw new Error('Empty response body')
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''
        let errorEvent: { code: string; message: string } | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6)
            if (payload === '[DONE]') break
            try {
              const parsed: unknown = JSON.parse(payload)
              if (typeof parsed === 'string') {
                accumulated += parsed
                setStreamingContent(accumulated)
              } else if (
                parsed &&
                typeof parsed === 'object' &&
                '__error' in parsed &&
                (parsed as { __error: unknown }).__error === true
              ) {
                const e = parsed as { code?: string; message?: string }
                errorEvent = {
                  code: e.code ?? 'AI_GENERIC_ERROR',
                  message: e.message ?? 'Er ging iets mis bij het genereren van het antwoord.',
                }
              }
            } catch {
              // skip malformed
            }
          }
        }

        // Persist any partial response we did get before the error.
        if (accumulated) {
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: accumulated,
          }
          setMessages((prev) => [...prev, assistantMsg])
        }

        // Surface a structured error as a separate message — never mix it
        // into the assistant's content bubble.
        if (errorEvent) {
          setMessages((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: errorEvent.message,
            },
          ])
          setLastFailedMessage(message)
        }
      } catch (err) {
        console.error('Chat send error:', err)
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Er is iets misgegaan. Tik op "Opnieuw" of stel je vraag opnieuw.',
          },
        ])
        setLastFailedMessage(message)
      } finally {
        setStreamingContent('')
        setIsLoading(false)
      }
    },
    [isLoading, sessionId],
  )

  // Auto-send initialMessage once history has loaded and there are no existing messages
  useEffect(() => {
    if (
      !initialMessage ||
      isInitializing ||
      initialMessageSentRef.current ||
      messages.length > 0
    ) return
    initialMessageSentRef.current = true
    handleSend(initialMessage)
  }, [initialMessage, isInitializing, messages.length, handleSend])

  if (isInitializing) {
    return (
      <div className={`flex h-full flex-col gap-3 ${compact ? 'p-3' : 'p-4'}`}>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className={`max-w-[75%] ${i % 2 === 0 ? 'ml-auto' : ''}`}>
            <SkeletonLine width="w-full" height="h-3" />
          </SkeletonCard>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 space-y-3 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-subhead text-label-tertiary">
              Stel een vraag of log een maaltijd
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {/* Streaming message */}
        {streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} isStreaming />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Retry + Suggestions + input */}
      <div className={compact ? 'p-2' : 'p-3'}>
        {lastFailedMessage && !isLoading && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => {
                // Remove the error message and retry
                setMessages((prev) => prev.filter((m) => !m.id.startsWith('error-')))
                handleSend(lastFailedMessage)
              }}
              className="rounded-full bg-system-blue/10 px-4 py-1.5 text-caption1 font-semibold text-system-blue transition-all duration-150 active:scale-95 hover:bg-system-blue/15"
            >
              Opnieuw proberen
            </button>
          </div>
        )}
        <ChatSuggestions onSelect={handleSend} visible={showSuggestions} />
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  )
}
