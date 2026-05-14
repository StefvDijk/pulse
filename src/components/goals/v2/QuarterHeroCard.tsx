interface QuarterHeroCardProps {
  completedCount: number
  totalCount: number
  activeCount: number
}

export function QuarterHeroCard({ completedCount, totalCount, activeCount }: QuarterHeroCardProps) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div
      className="rounded-[22px] border-[0.5px] p-[18px]"
      style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,229,199,0.10))',
        borderColor: 'rgba(124,58,237,0.30)',
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.4px]"
        style={{ color: '#A78BFA' }}
      >
        Kwartaalvoortgang
      </div>
      <div className="mt-1 text-[22px] font-bold leading-[1.2] tracking-[-0.4px] text-text-primary">
        {completedCount} van {totalCount} doelen
        <br />
        voltooid
      </div>
      <div className="mt-3.5 h-2 overflow-hidden rounded-[4px] bg-white/[0.06]">
        <div
          className="h-full rounded-[4px] transition-all"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #7C3AED, #00E5C7)',
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-text-tertiary">
        <span>{pct}% voltooid</span>
        <span>{activeCount} actief</span>
      </div>
    </div>
  )
}
