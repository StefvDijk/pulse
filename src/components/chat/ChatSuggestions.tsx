'use client'

const SUGGESTIONS = [
  'Hoe zit ik met eiwit vandaag?',
  'Hoe was mijn week?',
  'Genereer een trainingsschema',
]

export interface ChatSuggestionsProps {
  onSelect: (suggestion: string) => void
  visible: boolean
}

export function ChatSuggestions({ onSelect, visible }: ChatSuggestionsProps) {
  if (!visible) return null

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="min-h-[44px] rounded-full px-3 py-1.5 text-xs transition-colors hover:opacity-90"
          style={{
            backgroundColor: '#1a1a2e',
            border: '1px solid #3a3a5c',
            color: '#8888a0',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
