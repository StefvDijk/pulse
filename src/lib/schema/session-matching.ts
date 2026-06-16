// Plan-vs-realiteit matching voor de schema-pagina.
//
// "Soepel tellen": een afgeronde sessie telt mee voor een geplande sessie van
// DEZELFDE sport die week — zonder exacte titel-match. Een krachtsessie vult
// dus een geplande gym-dag, ook als je Upper i.p.v. Lower deed, of als de
// Hevy-titel een ander streepje gebruikt ("Upper A - Kracht" vs het geplande
// "Upper A — Kracht"). Vóór deze fix eiste gym een exacte titel-match, waardoor
// echte sessies nooit telden (zie de "0/5 sessies"-bug).

export type SessionKind = 'gym' | 'run' | 'padel'

export function focusKind(focus: string): SessionKind {
  const f = focus.toLowerCase().trim()
  if (f.includes('hardlopen') || f.includes('run')) return 'run'
  if (f.includes('padel')) return 'padel'
  return 'gym'
}

export interface PlannedSlot {
  focus: string
  plannedDate: string
  completed: boolean
  actualDate?: string
}

export interface CompletionRec {
  date: string
  kind: SessionKind
  used: boolean
}

/**
 * Koppel geplande sessies aan afgeronde sessies van hetzelfde soort.
 * Twee passes: eerst exact op datum, dan elke nog-vrije sessie binnen de week.
 * Muteert `planned` (completed/actualDate) en `completions` (used) in-place.
 */
export function pairSessions(planned: PlannedSlot[], completions: CompletionRec[]): void {
  const find = (kind: SessionKind, dateConstraint?: string): CompletionRec | undefined =>
    completions.find(
      (c) => !c.used && c.kind === kind && (dateConstraint === undefined || c.date === dateConstraint),
    )

  // Pass 1: exact-datum pairing.
  for (const r of planned) {
    const c = find(focusKind(r.focus), r.plannedDate)
    if (c) {
      c.used = true
      r.actualDate = c.date
      r.completed = true
    }
  }

  // Pass 2: koppel resterende geplande sessies aan elke in-week-sessie van dat soort.
  for (const r of planned) {
    if (r.completed) continue
    const c = find(focusKind(r.focus))
    if (c) {
      c.used = true
      r.actualDate = c.date
      r.completed = true
    }
  }
}
