import { Card } from '@/components/ui/v2'

interface Stat {
  v: string | number
  u: string
  l: string
}

interface WorkoutStatsBarProps {
  stats: Stat[]
}

export function WorkoutStatsBar({ stats }: WorkoutStatsBarProps) {
  const visible = stats.slice(0, 4)

  return (
    <Card className={`grid p-[14px_8px]`} style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}>
      {visible.map((s, i) => (
        <div
          key={i}
          className={`px-1.5 text-center ${i > 0 ? 'border-l-[0.5px] border-bg-border' : ''}`}
        >
          <div className="text-[18px] font-bold tracking-[-0.4px] tabular-nums">
            {s.v}
            <span className="ml-0.5 text-[10px] font-medium text-text-tertiary">{s.u}</span>
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-text-tertiary">{s.l}</div>
        </div>
      ))}
    </Card>
  )
}
