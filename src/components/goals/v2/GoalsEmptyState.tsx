import { Card } from '@/components/ui/v2'

interface GoalsEmptyStateProps {
  onAdd: () => void
}

function TargetIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-text-muted" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </svg>
  )
}

export function GoalsEmptyState({ onAdd }: GoalsEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-10">
      <TargetIcon />
      <p className="text-[13px] text-text-tertiary">Nog geen actieve doelen</p>
      <button onClick={onAdd} className="text-[13px] font-medium text-[#0A84FF]">
        + Voeg je eerste doel toe
      </button>
    </Card>
  )
}
