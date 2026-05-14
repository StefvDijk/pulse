'use client'

interface CompletedToggleProps {
  count: number
  open: boolean
  onToggle: () => void
}

export function CompletedToggle({ count, open, onToggle }: CompletedToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 text-[13px] font-medium text-text-tertiary"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        aria-hidden="true"
      >
        <path
          d="M2 4l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Voltooid ({count})
    </button>
  )
}
