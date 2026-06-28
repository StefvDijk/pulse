'use client'

import type { WeekplanCardData } from '@/lib/ai/chat/cards'

const DAY_NL: Record<string, string> = {
  monday: 'ma', tuesday: 'di', wednesday: 'wo', thursday: 'do',
  friday: 'vr', saturday: 'za', sunday: 'zo',
}

export interface WeekplanCardProps { data: WeekplanCardData }

export function WeekplanCard({ data }: WeekplanCardProps) {
  return (
    <div className="mt-2 rounded-[13px] border-[0.5px] border-[rgba(0,229,199,0.2)] bg-[rgba(0,229,199,0.04)] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-caption1 font-semibold uppercase tracking-[0.4px] text-text-tertiary">
          Weekplan
        </span>
        <span className="text-caption1 text-text-tertiary">{data.week}</span>
      </div>
      <div className="mt-2 space-y-1">
        {data.sessions.map((s, i) => (
          <div key={i} className="flex items-baseline gap-2">
            <span className="w-6 shrink-0 text-caption1 font-medium text-text-tertiary">
              {DAY_NL[s.day] ?? s.day.slice(0, 2)}
            </span>
            <span className="text-caption1 text-text-secondary">{s.focus}</span>
            {s.duration_min != null && (
              <span className="ml-auto shrink-0 text-[11px] text-text-tertiary">{s.duration_min}m</span>
            )}
          </div>
        ))}
      </div>
      {data.note && (
        <p className="mt-1.5 text-[11px] italic text-text-tertiary">{data.note}</p>
      )}
    </div>
  )
}
