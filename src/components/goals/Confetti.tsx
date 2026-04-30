'use client'

import { useMemo } from 'react'

const PARTICLE_COUNT = 20
const COLORS = ['#16A34A', '#FFB020', '#FF5E3A', '#0EA5E9', '#A855F7']

interface Particle {
  id: number
  left: number
  delay: number
  duration: number
  color: string
  size: number
  rotate: number
}

/**
 * Lightweight CSS-only confetti burst. Renders 20 small absolutely-positioned
 * squares falling from the top of the parent container with random colour,
 * size, delay and rotation. Auto-removes via parent unmount when the burst
 * finishes (no JS animation loop).
 */
export function Confetti() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 200,
      duration: 1200 + Math.random() * 600,
      color: COLORS[i % COLORS.length],
      size: 4 + Math.random() * 4,
      rotate: Math.random() * 360,
    }))
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute -top-2 block animate-pulse-fall"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes pulse-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(140px) rotate(540deg);
            opacity: 0;
          }
        }
        :global(.animate-pulse-fall) {
          animation-name: pulse-fall;
          animation-timing-function: cubic-bezier(0.4, 0.6, 0.6, 1);
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  )
}
