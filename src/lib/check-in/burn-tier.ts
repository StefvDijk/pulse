export type BurnTierLabel =
  | 'Achterstand'
  | 'Op stoom'
  | 'In ritme'
  | 'Voor de troepen uit'
  | 'Topweek'

export interface BurnTierContributor {
  metric: string
  current: number | null
  baseline: number | null
  ratio: number | null // current / baseline, null when baseline missing
}

export interface BurnTierResult {
  /** 0–1 normalised position on the bar (0 = far left, 1 = far right). */
  position: number
  /** Raw ratio of currentLoad / baselineLoad. */
  ratio: number
  tier: BurnTierLabel
  /** Tailwind color class for the tier marker. */
  colorClass: string
}

interface ComputeInput {
  currentLoad: number
  baselineLoad: number
}

const TIERS: Array<{
  max: number
  label: BurnTierLabel
  colorClass: string
}> = [
  { max: 0.6, label: 'Achterstand', colorClass: 'bg-system-red' },
  { max: 0.85, label: 'Op stoom', colorClass: 'bg-system-orange' },
  { max: 1.15, label: 'In ritme', colorClass: 'bg-system-green' },
  { max: 1.4, label: 'Voor de troepen uit', colorClass: 'bg-system-blue' },
  { max: Infinity, label: 'Topweek', colorClass: 'bg-system-purple' },
]

/**
 * Map a current-week training load + the user's recent baseline load to a
 * 5-tier "burn" classification. The position is clamped to [0, 1] so it
 * always renders inside the bar.
 */
export function computeBurnTier({
  currentLoad,
  baselineLoad,
}: ComputeInput): BurnTierResult {
  const ratio = baselineLoad > 0 ? currentLoad / baselineLoad : 0

  // Map ratio range [0, 2] to bar [0, 1] linearly, clamped.
  const position = Math.max(0, Math.min(1, ratio / 2))

  const tier = TIERS.find((t) => ratio < t.max) ?? TIERS[TIERS.length - 1]

  return {
    position,
    ratio,
    tier: tier.label,
    colorClass: tier.colorClass,
  }
}

export const BURN_TIER_LABELS: BurnTierLabel[] = [
  'Achterstand',
  'Op stoom',
  'In ritme',
  'Voor de troepen uit',
  'Topweek',
]
