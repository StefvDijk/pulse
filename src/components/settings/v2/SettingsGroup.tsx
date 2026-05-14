import type { ReactNode } from 'react'

interface SettingsGroupProps {
  title: string
  children: ReactNode
}

/**
 * SettingsGroup v2 — iOS-style grouped settings section.
 * Eyebrow label above, card with surface + hairline border, radius 14.
 * Matches screens/More.jsx::Settings Group component.
 */
export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">
        {title}
      </p>
      <div className="overflow-hidden rounded-[14px] border-[0.5px] border-bg-border bg-bg-surface">
        {children}
      </div>
    </div>
  )
}
