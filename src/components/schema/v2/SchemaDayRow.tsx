'use client'

import { Check } from 'lucide-react'

/**
 * SchemaDayRow — v2 design reference day card for the Schema week list.
 * Matches the day card layout from SchemaWeek in screens/Other.jsx:
 * date column | 3px sport-colour bar | title+subtitle | status badge
 */

type SportType = 'gym' | 'run' | 'padel' | 'cycle'

const SPORT_BASE: Record<SportType, string> = {
  gym: '#00E5C7',
  run: '#FF5E3A',
  padel: '#FFB020',
  cycle: '#9CFF4F',
}

const SPORT_LABEL: Record<SportType, string> = {
  gym: 'Krachttraining',
  run: 'Hardlopen',
  padel: 'Padel',
  cycle: 'Fietsen',
}

export interface SchemaDayRowProps {
  dayLabel: string
  dateNum: number
  sport: SportType | null
  title: string
  subtitle?: string
  duration?: string
  isDone: boolean
  isToday: boolean
  onClick?: () => void
}

export function SchemaDayRow({
  dayLabel,
  dateNum,
  sport,
  title,
  subtitle,
  duration,
  isDone,
  isToday,
  onClick,
}: SchemaDayRowProps) {
  const sportColor = sport ? SPORT_BASE[sport] : null
  const isRest = !sport

  const containerStyle = isToday
    ? {
        background: 'linear-gradient(135deg, rgba(0,229,199,0.10), rgba(124,58,237,0.06))',
        border: '0.5px solid rgba(0,229,199,0.30)',
        borderRadius: 18,
      }
    : {
        background: 'var(--color-bg-surface)',
        border: '0.5px solid var(--color-bg-border)',
        borderRadius: 18,
      }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`flex items-center gap-3.5 p-3.5 overflow-hidden relative ${onClick ? 'cursor-pointer active:opacity-60' : ''}`}
      style={containerStyle}
    >
      {/* Date column */}
      <div className="w-11 text-center shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.6px] text-text-tertiary">
          {dayLabel}
        </div>
        <div
          className="text-[22px] font-bold tracking-[-0.4px] mt-0.5 tabular-nums"
          style={{ color: isToday ? '#00E5C7' : 'var(--color-text-primary)' }}
        >
          {dateNum}
        </div>
      </div>

      {/* Sport bar */}
      <div
        className="shrink-0 rounded-sm"
        style={{
          width: 3,
          height: 38,
          background: sportColor ?? 'rgba(255,255,255,0.10)',
          boxShadow: sportColor ? `0 0 12px ${sportColor}` : 'none',
        }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-text-primary truncate">{title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-secondary">
          {isRest ? (
            <span>Rustdag</span>
          ) : (
            <>
              {sport && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: sportColor! }}
                />
              )}
              <span>
                {sport ? SPORT_LABEL[sport] : ''}
                {duration ? ` · ${duration}` : ''}
                {subtitle ? ` · ${subtitle}` : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status */}
      {isDone && sportColor ? (
        <div
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: sportColor }}
        >
          <Check size={14} strokeWidth={2.8} color="#000" />
        </div>
      ) : isToday ? (
        <span
          className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ color: '#00E5C7', background: 'rgba(0,229,199,0.14)' }}
        >
          vandaag
        </span>
      ) : null}
    </div>
  )
}
