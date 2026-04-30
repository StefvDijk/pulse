'use client'

import useSWR from 'swr'

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
  const day = new Date().getDay()
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
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="min-h-[44px] rounded-full bg-[#0A84FF]/10 px-4 py-1.5 text-caption1 font-semibold text-[#0A84FF] transition-all duration-150 active:scale-95 hover:bg-[#0A84FF]/15"
        >
          {s}
        </button>
      ))}
    </div>
  )
}
