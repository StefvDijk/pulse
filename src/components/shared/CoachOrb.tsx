'use client'

import { memo } from 'react'

// Coach Orb — Pulse's signature visual element for the AI coach.
// Renders the Anthropic Claude wordmark on a coral disc, with state-tinted
// background to communicate readiness:
//   idle/streaming → brand-claude (coral)
//   ready          → status-good  (green)
//   warning        → status-warn  (amber)
//   alert          → status-bad   (red)
export type CoachOrbState = 'idle' | 'streaming' | 'ready' | 'warning' | 'alert'

export interface CoachOrbProps {
  size?: number
  state?: CoachOrbState
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

const CLAUDE_PATH =
  'M4.79 16.97L9.32 14.43L9.4 14.2L9.32 14.08H9.09L8.32 14.03L5.69 13.96L3.42 13.86L1.22 13.74L0.67 13.62L0.15 12.94L0.21 12.59L0.67 12.28L1.34 12.34L2.81 12.44L5.02 12.59L6.62 12.69L8.99 12.94H9.36L9.41 12.81L9.28 12.71L9.18 12.62L6.93 11.09L4.49 9.48L3.21 8.55L2.52 8.07L2.17 7.63L2.02 6.66L2.65 5.96L3.5 6.02L3.72 6.08L4.59 6.75L6.45 8.19L8.88 9.98L9.23 10.28L9.37 10.18L9.39 10.11L9.23 9.85L7.92 7.48L6.52 5.07L5.9 4.07L5.73 3.47C5.67 3.22 5.63 3.01 5.63 2.76L6.34 1.79L6.74 1.66L7.69 1.79L8.09 2.14L8.69 3.5L9.65 5.64L11.15 8.56L11.59 9.43L11.82 10.24L11.91 10.49H12.06V10.35L12.18 8.74L12.4 6.76L12.62 4.21L12.69 3.49L13.04 2.65L13.74 2.19L14.28 2.45L14.73 3.09L14.67 3.5L14.4 5.27L13.88 7.97L13.54 9.78H13.74L13.96 9.56L14.86 8.37L16.36 6.49L17.02 5.74L17.79 4.93L18.29 4.54H19.22L19.91 5.56L19.6 6.61L18.62 7.85L17.81 8.9L16.65 10.46L15.93 11.71L16 11.81L16.18 11.79L18.96 11.2L20.46 10.93L22.25 10.62L23.06 11L23.15 11.38L22.83 12.16L20.93 12.63L18.71 13.07L15.4 13.85L15.36 13.88L15.4 13.93L16.89 14.07L17.53 14.1H19.09L21.99 14.32L22.75 14.82L23.21 15.43L23.13 15.9L21.97 16.5L20.4 16.13L16.74 15.26L15.49 14.95H15.32V15.05L16.36 16.07L18.27 17.79L20.66 20.01L20.78 20.56L20.47 21L20.14 20.95L18.02 19.36L17.2 18.64L15.34 17.07H15.22V17.23L15.65 17.86L17.93 21.29L18.05 22.34L17.88 22.69L17.29 22.9L16.63 22.78L15.28 20.89L13.9 18.77L12.78 16.86L12.65 16.94L12 23.85L11.7 24.21L11 24.48L10.42 24.04L10.11 23.32L10.42 21.91L10.79 20.07L11.09 18.61L11.36 16.81L11.52 16.21V16.17H11.41L10.27 17.74L8.54 20.08L7.18 21.54L6.85 21.67L6.29 21.38L6.34 20.86L6.65 20.4L8.54 17.99L9.68 16.51L10.42 15.65L10.41 15.53H10.38L5.92 18.46L5.13 18.56L4.79 18.24L4.83 17.71Z'

function CoachOrbImpl({ size = 24, state = 'idle', pulsing, className = '' }: CoachOrbProps) {
  const color = STATE_VAR[state]
  const isPulsing = pulsing ?? state === 'streaming'
  const glyph = Math.round(size * 0.62)

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
      aria-hidden="true"
    >
      {isPulsing && (
        <span
          className="absolute inset-0 rounded-full animate-coach-orb motion-reduce:animate-none"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${color} 60%, transparent) 0%, transparent 70%)`,
          }}
        />
      )}
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        className="relative"
      >
        <path d={CLAUDE_PATH} fill="#FFFFFF" />
      </svg>
    </span>
  )
}

export const CoachOrb = memo(CoachOrbImpl)
