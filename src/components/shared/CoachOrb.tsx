'use client'

import { memo } from 'react'

// Coach Orb — Pulse's signature visual element for the AI coach.
// Defaults to brand-claude (Anthropic coral). State tints map to readiness:
//   ready   → status-good (green)
//   warning → status-warn (amber)
//   alert   → status-bad  (red)
// `streaming` keeps brand-claude but pulses to indicate the model is working.
export type CoachOrbState = 'idle' | 'streaming' | 'ready' | 'warning' | 'alert'

export interface CoachOrbProps {
  /** Diameter of the inner core in pixels. Halo extends beyond. Default 24. */
  size?: number
  state?: CoachOrbState
  /** Force pulsing on/off. Defaults to true when state === 'streaming'. */
  pulsing?: boolean
  className?: string
}

const STATE_VAR: Record<CoachOrbState, string> = {
  idle: 'var(--color-brand-claude)',
  streaming: 'var(--color-brand-claude)',
  ready: 'var(--color-status-good)',
  warning: 'var(--color-status-warn)',
  alert: 'var(--color-status-bad)',
}

function CoachOrbImpl({ size = 24, state = 'idle', pulsing, className = '' }: CoachOrbProps) {
  const color = STATE_VAR[state]
  const isPulsing = pulsing ?? state === 'streaming'
  const haloSize = Math.round(size * 1.6)

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Halo — radial bloom around the core, pulses while streaming */}
      <span
        className={`absolute rounded-full ${
          isPulsing ? 'animate-coach-orb motion-reduce:animate-none' : ''
        }`}
        style={{
          width: haloSize,
          height: haloSize,
          background: `radial-gradient(circle, color-mix(in srgb, ${color} 45%, transparent) 0%, color-mix(in srgb, ${color} 0%, transparent) 70%)`,
        }}
      />
      {/* Core */}
      <span
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${color} 90%, white) 0%, ${color} 60%, color-mix(in srgb, ${color} 80%, black) 100%)`,
          boxShadow: `0 0 ${Math.round(size / 3)}px color-mix(in srgb, ${color} 30%, transparent), inset 0 1px 1px rgba(255,255,255,0.25)`,
        }}
      />
    </span>
  )
}

export const CoachOrb = memo(CoachOrbImpl)
