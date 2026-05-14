import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface SettingsRowProps {
  /** 28×28 icon tile */
  icon: ReactNode
  /** Row label */
  label: string
  /** Optional trailing value text */
  value?: string
  /** Trailing element — overrides the default value+chevron */
  trailing?: ReactNode
  /** If true, label renders in status-bad red */
  danger?: boolean
  /** Suppress bottom border (last row in group) */
  last?: boolean
  /** Click handler — makes the row tappable */
  onClick?: () => void
}

/**
 * SettingsRow v2 — iOS-style settings list row.
 * Left: 28px icon tile. Center: label. Right: value + chevron.
 * Matches screens/More.jsx::Settings Row component.
 */
export function SettingsRow({
  icon,
  label,
  value,
  trailing,
  danger = false,
  last = false,
  onClick,
}: SettingsRowProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 px-4 py-3 text-left',
        !last ? 'border-b border-[0.5px] border-bg-border' : '',
        onClick ? 'active:opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Icon tile */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]">
        {icon}
      </div>

      {/* Label */}
      <span
        className={`flex-1 text-[15px] ${danger ? 'text-status-bad' : 'text-text-primary'}`}
      >
        {label}
      </span>

      {/* Trailing */}
      {trailing ?? (
        <>
          {value && (
            <span className="mr-1 text-[13px] tabular-nums text-text-tertiary">{value}</span>
          )}
          {onClick && (
            <ChevronRight size={14} className="shrink-0 text-text-muted" strokeWidth={1.6} />
          )}
        </>
      )}
    </Tag>
  )
}
