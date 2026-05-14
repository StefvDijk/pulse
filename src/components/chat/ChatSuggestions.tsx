'use client'

import useSWR from 'swr'
import { dayIndexAmsterdam } from '@/lib/time/amsterdam'
import { Button } from '@/components/ui'

interface SuggestionsResponse {
  suggestions: string[]
  source: 'ai' | 'fallback' | 'error_fallback'
}

async function fetcher(url: string): Promise<SuggestionsResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }
  return res.json()
}

function getDayBasedFallback(): string[] {
  // Amsterdam-bewust dagnummer → JS-style (0=zo, 1=ma, …, 6=za) zodat de
  // bestaande v2-structuur (case 0/1/5/6) intact blijft.
  const idx = dayIndexAmsterdam() // 1=ma…7=zo
  const day = idx === 7 ? 0 : idx
  switch (day) {
    case 0:
      return ['Hoe was mijn week?', 'Check mijn progressie', 'Hoe sta ik met mijn doelen?', 'Log wat ik heb gegeten']
    case 1:
      return ['Wat train ik vandaag?', 'Hoe bereid ik me voor op padel?', 'Hoe zit ik met eiwit?', 'Log wat ik heb gegeten']
    case 5:
      return ['Tips voor mijn run', 'Hoe was mijn trainingsweek?', 'Hoe sta ik met mijn doelen?', 'Log wat ik heb gegeten']
    case 6:
      return ['Hoe sta ik met mijn doelen?', 'Analyseer mijn week', 'Hoe zit ik met eiwit?', 'Log wat ik heb gegeten']
    default:
      return ['Wat train ik vandaag?', 'Hoe sta ik met mijn doelen?', 'Hoe zit ik met eiwit?', 'Log wat ik heb gegeten']
  }
}

export interface ChatSuggestionsProps {
  onSelect: (suggestion: string) => void
  visible: boolean
}

export function ChatSuggestions({ onSelect, visible }: ChatSuggestionsProps) {
  const { data } = useSWR<SuggestionsResponse>(
    visible ? '/api/chat/suggestions' : null,
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000, // 5 min
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000,
    },
  )

  if (!visible) return null

  const suggestions = data?.suggestions ?? getDayBasedFallback()

  return (
    <div className="flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
      {suggestions.map((s) => (
        <Button
          key={s}
          variant="glass"
          size="sm"
          className="shrink-0"
          onClick={() => onSelect(s)}
        >
          {s}
        </Button>
      ))}
    </div>
  )
}
