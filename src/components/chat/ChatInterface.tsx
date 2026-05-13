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

// [SDK#2] Human-readable labels for the in-flight tool indicator.
const TOOL_LABELS: Record<string, string> = {
  get_workout_history: 'Workouts ophalen…',
  get_exercise_stats: 'Oefening-stats ophalen…',
  get_running_history: 'Runs ophalen…',
  get_health_metrics: 'Gezondheidsmetrics ophalen…',
  get_nutrition_log: 'Voedingslog ophalen…',
  get_macro_targets: 'Macro-targets ophalen…',
  get_body_composition: 'Body-comp ophalen…',
  get_active_schema: 'Schema ophalen…',
  get_injury_history: 'Blessure-historie ophalen…',
  get_weekly_aggregations: 'Week-aggregaties ophalen…',
  search_exercises: 'Oefeningen zoeken…',
  compare_periods: 'Periodes vergelijken…',
  calculate_progressive_overload: 'Progressive overload berekenen…',
  get_recovery_score: 'Recovery score berekenen…',
  get_other_activities: 'Activiteiten ophalen…',
  log_nutrition: 'Maaltijd loggen…',
  log_injury: 'Blessure loggen…',
  propose_schema_generation: 'Nieuw schema aanmaken…',
  propose_schema_update: 'Schema aanpassen…',
}
function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `Tool: ${name}…`
}

export function ChatInterface({ sessionId: initialSessionId, compact = false, initialMessage }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  // [SDK#2] activeTool surfaces "fetching workout history…" labels while
  // a tool call is running. Cleared once tool-result arrives.
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [isInitializing, setIsInitializing] = useState(true)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const initialMessageSentRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

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
              const parsed = JSON.parse(payload) as
                | string
                | { type: 'tool_call' | 'tool_result' | 'tool_error'; toolName: string }
              if (typeof parsed === 'string') {
                accumulated += parsed
                setStreamingContent(accumulated)
              } else if (parsed.type === 'tool_call') {
                setActiveTool(parsed.toolName)
              } else if (parsed.type === 'tool_result' || parsed.type === 'tool_error') {
                setActiveTool(null)
              }
            } catch {
              // skip malformed
            }
          }
        }
        // Clear any leftover tool indicator (defensive — should already be null).
        setActiveTool(null)

        if (accumulated) {
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: accumulated,
          }
          setMessages((prev) => [...prev, assistantMsg])
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
      <div className={`flex-1 space-y-3 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}>
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

        {/* [SDK#2] Active-tool indicator: shows what the agent is fetching */}
        {activeTool && !streamingContent && (
          <div className="flex items-center gap-2 text-caption1 text-label-tertiary px-2 py-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-system-blue animate-pulse" />
            <span>{toolLabel(activeTool)}</span>
          </div>
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
