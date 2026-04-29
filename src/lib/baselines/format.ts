import { HIGHER_IS_BETTER, type BaselineMetric, type BaselineWindow } from './types'

export type BaselineDirection = 'up' | 'down' | 'flat'
export type BaselineSentiment = 'positive' | 'negative' | 'neutral'

export interface FormattedBaseline {
  /** "↑12%" / "↓4%" / "—" */
  text: string
  /** Direction of change vs baseline. */
  direction: BaselineDirection
  /** Whether the change reads positively for this metric. */
  sentiment: BaselineSentiment
  /** Raw % delta, signed. Null if baseline is missing. */
  pct: number | null
}

const NOISE_THRESHOLD_PCT = 2 // |delta| < 2% is considered flat / not worth highlighting

interface FormatInput {
  current: number | null
  baseline: number | null
  metric?: BaselineMetric
  window?: BaselineWindow
  /** Override the metric default — useful for context-specific UIs (e.g.
   * "weight up" reads positive in muscle-gain mode but negative in cut). */
  higherIsBetterOverride?: boolean
}

export function formatBaseline(input: FormatInput): FormattedBaseline {
  const { current, baseline, metric, higherIsBetterOverride } = input

  if (current === null || baseline === null || baseline === 0) {
    return { text: '—', direction: 'flat', sentiment: 'neutral', pct: null }
  }

  const pct = ((current - baseline) / baseline) * 100
  const absPct = Math.abs(pct)

  if (absPct < NOISE_THRESHOLD_PCT) {
    return { text: '—', direction: 'flat', sentiment: 'neutral', pct }
  }

  const direction: BaselineDirection = pct > 0 ? 'up' : 'down'
  const arrow = direction === 'up' ? '↑' : '↓'
  const text = `${arrow}${Math.round(absPct)}%`

  const higherIsBetter = higherIsBetterOverride ?? (metric ? HIGHER_IS_BETTER[metric] : true)
  let sentiment: BaselineSentiment
  if ((direction === 'up' && higherIsBetter) || (direction === 'down' && !higherIsBetter)) {
    sentiment = 'positive'
  } else {
    sentiment = 'negative'
  }

  return { text, direction, sentiment, pct }
}
