import type { ReactNode } from 'react'

interface FormSectionProps {
  title: string
  children: ReactNode
}

/**
 * FormSection v2 — groups editable form fields under an eyebrow title.
 * Uses the card pattern (bg-bg-surface + hairline border + radius 18).
 * Distinct from SettingsGroup which uses read-only rows; this hosts
 * input fields (Profile, Koppelingen, Trainingsdoelen, etc.).
 */
export function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="rounded-[18px] border-[0.5px] border-bg-border bg-bg-surface p-[16px_18px]">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">
        {title}
      </p>
      {children}
    </div>
  )
}
