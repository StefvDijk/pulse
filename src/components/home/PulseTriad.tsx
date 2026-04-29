'use client'

import Link from 'next/link'
import { useTriadData } from '@/hooks/useTriadData'

// ── Pillar config ────────────────────────────────────────────────────────────

interface PillarConfig {
  title: string
  href: string
  ringColor: string
  trackColor: string
}

const PILLARS: Record<'train' | 'recover' | 'fuel', PillarConfig> = {
  train: {
    title: 'Train',
    href: '/schema',
    ringColor: 'var(--color-sport-gym-base)',
    trackColor: 'var(--color-sport-gym-light)',
  },
  recover: {
    title: 'Recover',
    href: '/belasting',
    ringColor: 'var(--color-status-good)',
    trackColor: 'rgba(34, 214, 122, 0.16)',
  },
  fuel: {
    title: 'Fuel',
    href: '/nutrition',
    ringColor: 'var(--color-sport-padel-base)',
    trackColor: 'var(--color-sport-padel-light)',
  },
}

// ── Ring sub-component ───────────────────────────────────────────────────────

interface PillarRingProps {
  title: string
  value: number
  label: string
  sub: string
  href: string
  ringColor: string
  trackColor: string
}

function PillarRing({ title, value, label, sub, href, ringColor, trackColor }: PillarRingProps) {
  const size = 96
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100)
  const center = size / 2

  return (
    <Link
      href={href}
      className="flex flex-1 flex-col items-center gap-2 active:opacity-70 transition-opacity"
    >
      <p className="text-caption2 font-semibold uppercase tracking-wider text-label-tertiary">
        {title}
      </p>

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-title3 font-semibold tabular-nums text-label-primary">
            {label}
          </span>
        </div>
      </div>

      <p className="text-caption1 leading-tight text-label-secondary text-center">
        {sub}
      </p>
    </Link>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function PulseTriad() {
  const { data, isLoading } = useTriadData()

  if (isLoading || !data) {
    return (
      <div
        className="rounded-3xl border border-separator bg-surface-primary p-5 shadow-apple-sm"
        aria-hidden="true"
      >
        <div className="flex items-start justify-around gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <div className="h-3 w-12 rounded-full bg-system-gray6" />
              <div className="h-24 w-24 rounded-full bg-system-gray6" />
              <div className="h-3 w-20 rounded-full bg-system-gray6" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-separator bg-surface-primary p-5 shadow-apple-sm">
      <div className="flex items-start justify-around gap-3">
        <PillarRing
          title={PILLARS.train.title}
          value={data.train.value}
          label={data.train.label}
          sub={data.train.sub}
          href={PILLARS.train.href}
          ringColor={PILLARS.train.ringColor}
          trackColor={PILLARS.train.trackColor}
        />
        <PillarRing
          title={PILLARS.recover.title}
          value={data.recover.value}
          label={data.recover.label}
          sub={data.recover.sub}
          href={PILLARS.recover.href}
          ringColor={PILLARS.recover.ringColor}
          trackColor={PILLARS.recover.trackColor}
        />
        <PillarRing
          title={PILLARS.fuel.title}
          value={data.fuel.value}
          label={data.fuel.label}
          sub={data.fuel.sub}
          href={PILLARS.fuel.href}
          ringColor={PILLARS.fuel.ringColor}
          trackColor={PILLARS.fuel.trackColor}
        />
      </div>
    </div>
  )
}
