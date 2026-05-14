'use client'

import { Toggle } from '@/components/ui/Toggle'

interface DryRunToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
}

/**
 * DryRunToggle v2 — test mode row using the Toggle primitive.
 * Replaces the raw <input type="checkbox"> in CheckInFlow.
 */
export function DryRunToggle({ checked, onChange }: DryRunToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-[16px] border-[0.5px] border-bg-border bg-bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px]">🧪</span>
        <span className="text-[13px] text-text-secondary">
          Test mode{' '}
          {checked && (
            <span className="text-status-warn">— niets wordt opgeslagen</span>
          )}
        </span>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        label="Test mode"
      />
    </div>
  )
}
