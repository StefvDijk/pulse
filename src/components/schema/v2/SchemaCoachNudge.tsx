import Link from 'next/link'
import { CoachOrb } from '@/components/shared/CoachOrb'

/**
 * SchemaCoachNudge — v2 coach nudge card at the bottom of the Schema week list.
 * Matches the coach action card in SchemaWeek (screens/Other.jsx).
 */
export interface SchemaCoachNudgeProps {
  message: string
  /** Optional seed text — when present, appended to /chat as ?seed=... */
  seed?: string
  /** Override target. If unset, computed from `seed`. */
  href?: string
}

export function SchemaCoachNudge({ message, seed, href }: SchemaCoachNudgeProps) {
  const target = href ?? (seed ? `/chat?seed=${encodeURIComponent(seed)}` : '/chat')
  return (
    <Link
      href={target}
      className="flex items-center gap-2.5 p-3.5 rounded-[18px] active:opacity-60 transition-opacity"
      style={{
        background: 'linear-gradient(135deg, rgba(255,94,58,0.12), rgba(255,45,135,0.10))',
        border: '0.5px solid rgba(255,255,255,0.10)',
      }}
    >
      <CoachOrb size={28} />
      <span className="flex-1 text-[13px] text-text-primary">{message}</span>
      <span className="text-[18px] text-text-tertiary">›</span>
    </Link>
  )
}
