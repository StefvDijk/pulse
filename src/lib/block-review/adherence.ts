export interface AdherenceInput {
  planned: number
  completed: number
}

export function computeAdherence({ planned, completed }: AdherenceInput): number | null {
  if (planned <= 0) return null
  const ratio = Math.min(completed, planned) / planned
  return Math.round(ratio * 1000) / 10
}
