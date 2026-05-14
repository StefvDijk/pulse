import { Card } from '@/components/ui/v2'
import type { WorkloadData } from '@/types/workload'

interface WorkloadStatsGridProps {
  data: WorkloadData
}

interface StatTileProps {
  label: string
  value: string | number
  unit?: string
}

function StatTile({ label, value, unit }: StatTileProps) {
  return (
    <Card className="p-[14px]">
      <div className="text-[11px] font-medium text-text-tertiary">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-[24px] font-bold tracking-[-0.6px] text-text-primary tabular-nums">{value}</div>
        {unit && <div className="text-[11px] text-text-tertiary">{unit}</div>}
      </div>
    </Card>
  )
}

export function WorkloadStatsGrid({ data }: WorkloadStatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatTile label="Acute (7d)" value={Math.round(data.acuteLoad)} unit="load" />
      <StatTile label="Chronisch (28d)" value={Math.round(data.chronicLoad)} unit="load" />
      <StatTile
        label="Sessies (7d)"
        value={data.acuteSessions}
        unit={`van ${Math.round(data.chronicSessions / 4) || 7}`}
      />
      <StatTile
        label="Sessies (28d)"
        value={data.chronicSessions}
        unit="totaal"
      />
    </div>
  )
}
