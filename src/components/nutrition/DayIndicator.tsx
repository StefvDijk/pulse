export interface DayIndicatorProps {
  calories: number
  calorieTarget: number | null
  protein: number
  proteinTarget: number | null
}

interface StatusInfo {
  label: string
  color: string
  bg: string
}

function getStatus(current: number, target: number | null): 'under' | 'on_track' | 'over' {
  if (!target) return 'on_track'
  const ratio = current / target
  if (ratio >= 0.9 && ratio <= 1.1) return 'on_track'
  if (ratio < 0.9) return 'under'
  return 'over'
}

const STATUS_MAP: Record<string, StatusInfo> = {
  on_track: { label: 'Op schema', color: '#16A34A', bg: '#F0FDF4' },
  under: { label: 'Te weinig', color: '#D97706', bg: '#FFFBEB' },
  over: { label: 'Te veel', color: '#DC2626', bg: '#FEF2F2' },
}

function getMessage(
  calorieStatus: string,
  proteinStatus: string,
  calories: number,
  calorieTarget: number | null,
  protein: number,
  proteinTarget: number | null,
): string {
  if (calorieStatus === 'on_track' && proteinStatus === 'on_track') {
    return 'Je zit goed vandaag 💪'
  }
  if (proteinStatus === 'under' && proteinTarget) {
    const missing = Math.round(proteinTarget - protein)
    return `Je mist nog ~${missing}g eiwit`
  }
  if (calorieStatus === 'under' && calorieTarget) {
    const missing = Math.round(calorieTarget - calories)
    return `Je mist nog ~${missing} kcal`
  }
  if (calorieStatus === 'over') {
    return 'Je zit boven je caloriedoel'
  }
  return 'Log je maaltijden om bij te houden hoe je er voor staat'
}

export function DayIndicator({ calories, calorieTarget, protein, proteinTarget }: DayIndicatorProps) {
  const calorieStatus = getStatus(calories, calorieTarget)
  const proteinStatus = getStatus(protein, proteinTarget)

  // Overall status: worst of the two
  const overallStatus =
    calorieStatus === 'over' || proteinStatus === 'over'
      ? 'over'
      : calorieStatus === 'under' || proteinStatus === 'under'
        ? 'under'
        : 'on_track'

  const statusInfo = STATUS_MAP[overallStatus]
  const message = getMessage(calorieStatus, proteinStatus, calories, calorieTarget, protein, proteinTarget)

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ backgroundColor: statusInfo.bg, border: `1px solid ${statusInfo.color}33` }}
    >
      <span
        className="shrink-0 rounded px-2 py-0.5 text-xs font-medium"
        style={{ color: statusInfo.color, backgroundColor: `${statusInfo.color}22` }}
      >
        {statusInfo.label}
      </span>
      <p className="text-sm text-text-primary">
        {message}
      </p>
    </div>
  )
}
