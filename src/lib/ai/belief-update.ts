// ---------------------------------------------------------------------------
// belief-update — pure confidence-recalc for coach_beliefs.
//
// Algoritme: weighted count-based with linear decay.
// - Elke evidence krijgt gewicht w = max(0.2, 1 - daysOld/60).
// - confidence = sum(w_for) / (sum(w_for) + sum(w_against)).
// - Geen evidence → 0.5 (neutraal).
// - confidence >= 0.85 EN (n_for + n_against) >= 4 → status confirmed.
// - confidence < 0.20 EN (n_for + n_against) >= 2 → status superseded.
// - status confirmed/rejected wijzigt niet meer automatisch.
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  date: string // ISO timestamp
  observation: string
  source: string
  kind: 'for' | 'against'
}

export interface BeliefInput {
  evidence_for: EvidenceItem[]
  evidence_against: EvidenceItem[]
  status: 'active' | 'confirmed' | 'superseded' | 'rejected'
}

export interface BeliefOutput {
  confidence: number
  status: 'active' | 'confirmed' | 'superseded' | 'rejected'
}

const CONFIRM_THRESHOLD = 0.85
const SUPERSEDE_THRESHOLD = 0.2
const MIN_DATAPOINTS_FOR_CONFIRM = 4
const MIN_DATAPOINTS_FOR_SUPERSEDE = 2
const MAX_DECAY_DAYS = 60
const MIN_WEIGHT = 0.2

function weightFor(item: EvidenceItem, now: number): number {
  const daysOld = (now - new Date(item.date).getTime()) / 86_400_000
  const w = 1 - daysOld / MAX_DECAY_DAYS
  return Math.max(MIN_WEIGHT, Math.min(1, w))
}

export function recomputeBelief(input: BeliefInput): BeliefOutput {
  if (input.status === 'confirmed' || input.status === 'rejected') {
    return { confidence: Number(computeConfidence(input).toFixed(2)), status: input.status }
  }

  const confidence = computeConfidence(input)
  const n = input.evidence_for.length + input.evidence_against.length

  let status: BeliefOutput['status'] = 'active'
  if (confidence >= CONFIRM_THRESHOLD && n >= MIN_DATAPOINTS_FOR_CONFIRM) {
    status = 'confirmed'
  } else if (confidence < SUPERSEDE_THRESHOLD && n >= MIN_DATAPOINTS_FOR_SUPERSEDE) {
    status = 'superseded'
  }

  return { confidence: Number(confidence.toFixed(2)), status }
}

function computeConfidence(input: BeliefInput): number {
  const now = Date.now()
  const wFor = input.evidence_for.reduce((s, e) => s + weightFor(e, now), 0)
  const wAgainst = input.evidence_against.reduce((s, e) => s + weightFor(e, now), 0)
  if (wFor + wAgainst === 0) return 0.5
  return wFor / (wFor + wAgainst)
}
