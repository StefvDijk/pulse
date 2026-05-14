import { Trophy } from 'lucide-react'

interface WorkoutHeroProps {
  title: string
  startedAt: string
  source?: string | null
  prCount?: number | null
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export function WorkoutHero({ title, startedAt, source, prCount }: WorkoutHeroProps) {
  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 100% at 100% 0%, rgba(0,229,199,0.30), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(124,58,237,0.18), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative px-4 pb-5 pt-6">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.4px]"
          style={{ color: '#00E5C7' }}
        >
          {formatDateLong(startedAt)} · {formatTime(startedAt)}
        </div>
        <h1 className="mt-1.5 text-[30px] font-bold tracking-[-0.7px] text-text-primary">
          {title}
        </h1>
        {source && (
          <div className="mt-1 text-[13px] text-text-secondary">{source}</div>
        )}
        {(prCount ?? 0) > 0 && (
          <div
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{
              background: 'linear-gradient(135deg, #FFB020, #FF5E3A)',
              boxShadow: '0 4px 12px rgba(255,176,32,0.4)',
            }}
          >
            <Trophy size={13} color="#1a1a1a" aria-hidden="true" />
            <span className="text-[12px] font-bold" style={{ color: '#1a1a1a' }}>
              {prCount} nieuwe PR{prCount === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
