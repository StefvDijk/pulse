'use client'

function getSuggestions(): string[] {
  const day = new Date().getDay()

  switch (day) {
    case 0: // Sunday - weekly review
      return ['Hoe was mijn week?', 'Check mijn progressie', 'Hoe sta ik met mijn doelen?']
    case 1: // Monday - gym + padel
      return ['Wat train ik vandaag?', 'Log wat ik heb gegeten', 'Hoe bereid ik me voor op padel?']
    case 2: // Tuesday
    case 3: // Wednesday
    case 4: // Thursday
      return ['Wat train ik vandaag?', 'Log wat ik heb gegeten', 'Hoe zit ik met eiwit vandaag?']
    case 5: // Friday - run day
      return ['Tips voor mijn run vandaag', 'Log wat ik heb gegeten', 'Hoe was mijn trainingsweek?']
    case 6: // Saturday - rest / flexible
      return ['Log wat ik heb gegeten', 'Hoe sta ik met mijn doelen?', 'Analyseer mijn week tot nu toe']
    default:
      return ['Log wat ik heb gegeten', 'Hoe sta ik met mijn doelen?', 'Hoe zit ik met eiwit vandaag?']
  }
}

export interface ChatSuggestionsProps {
  onSelect: (suggestion: string) => void
  visible: boolean
}

export function ChatSuggestions({ onSelect, visible }: ChatSuggestionsProps) {
  if (!visible) return null

  const suggestions = getSuggestions()

  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="min-h-[44px] rounded-full bg-system-blue/10 px-4 py-1.5 text-caption1 font-semibold text-system-blue transition-all duration-150 active:scale-95 hover:bg-system-blue/15"
        >
          {s}
        </button>
      ))}
    </div>
  )
}
