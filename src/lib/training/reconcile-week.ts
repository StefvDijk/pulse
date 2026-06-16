/** Sport-categorie van een sessie. */
export type ActivityKind = 'gym' | 'run' | 'padel'

export type ReconciledState =
  | 'done-as-planned'
  | 'done-swap'
  | 'done-extra'
  | 'planned'
  | 'planned-today'
  | 'missed'

export interface PlannedExerciseInput {
  name: string
  sets?: number
  reps?: string
  rest_seconds?: number
  rpe?: string
  tempo?: string
  notes?: string
}

export interface PlannedSession {
  plannedDate: string // YYYY-MM-DD (Amsterdam)
  focus: string
  kind: ActivityKind
  exercises?: PlannedExerciseInput[]
  subtitle?: string
  durationMin?: number
}

export interface CompletionInput {
  date: string // YYYY-MM-DD (Amsterdam)
  kind: ActivityKind
  title: string
  id?: string
  durationSeconds?: number | null
  startedAt?: string
  distanceMeters?: number
  /** Opake passthrough (bv. geëxtraheerde oefeningen) — de lib raakt dit niet aan. */
  exercises?: unknown
}

export interface ReconciledItem {
  kind: ActivityKind
  state: ReconciledState
  /** Dag waarop het item getoond wordt (actual bij done-*, anders gepland). */
  displayDate: string
  /** Toon-titel: actual bij done-*, geplande focus anders. */
  title: string
  plannedDate?: string
  plannedFocus?: string
  actualDate?: string
  /** Gezet als plannedDate !== actualDate (cross-day verplaatst); UI toont "↩ <dag>". */
  movedFromDate?: string
  /** done-swap: de oorspronkelijk geplande focus. */
  swappedFrom?: string
  completionId?: string
  durationSeconds?: number | null
  startedAt?: string
  distanceMeters?: number
  plannedExercises?: PlannedExerciseInput[]
  actualExercises?: unknown
  subtitle?: string
  durationMin?: number
}

export interface ReconcileOptions {
  today: string // YYYY-MM-DD (Amsterdam)
}

/** Canonicaliseer een titel voor gelijkheids-matching. */
export function canon(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s*[—–-]\s+.*$/u, '') // beschrijvende staart met spatie eromheen
    .replace(/\s+/g, ' ')
    .trim()
}

export function titlesMatch(a: string, b: string): boolean {
  return canon(a) === canon(b)
}

const KIND_ORDER: ActivityKind[] = ['gym', 'run', 'padel']

function makeDoneItem(
  slot: PlannedSession,
  c: CompletionInput,
  state: 'done-as-planned' | 'done-swap',
  displayDate: string,
  movedFromDate?: string,
): ReconciledItem {
  return {
    kind: c.kind,
    state,
    displayDate,
    title: c.title,
    plannedDate: slot.plannedDate,
    plannedFocus: slot.focus,
    actualDate: c.date,
    movedFromDate,
    swappedFrom: state === 'done-swap' ? slot.focus : undefined,
    completionId: c.id,
    durationSeconds: c.durationSeconds,
    startedAt: c.startedAt,
    distanceMeters: c.distanceMeters,
    plannedExercises: slot.exercises,
    actualExercises: c.exercises,
    subtitle: slot.subtitle,
    durationMin: slot.durationMin,
  }
}

/**
 * Koppel geplande sessies aan daadwerkelijk gelogde sessies binnen één week.
 * Step A: per dag (zelfde-slot, sport-bewust). Step B: cross-day rescue voor
 * gym op gelijke gecanonicaliseerde titel. Daarna: resterende planned ->
 * planned/planned-today/missed, resterende completions -> done-extra.
 */
export function reconcileWeek(
  planned: PlannedSession[],
  completions: CompletionInput[],
  opts: ReconcileOptions,
): ReconciledItem[] {
  const { today } = opts
  const comps = completions.map((c) => ({ ...c, used: false }))
  const slots = planned.map((p) => ({ ...p, fulfilled: false }))
  const items: ReconciledItem[] = []

  const dates = Array.from(
    new Set<string>([...slots.map((s) => s.plannedDate), ...comps.map((c) => c.date)]),
  ).sort()

  // ── Step A: per-dag, zelfde-slot ──
  // Sub-pass 1 claimt "as-planned" matches eerst: gym op gelijke titel, run/padel op
  // sport (hun completion-titel is generiek, bv. 'Hardlopen', dus titel zegt niets).
  // Zo wint een titel-match altijd van een niet-matchende gym-sessie diezelfde dag.
  // Sub-pass 2 koppelt resterende sessies aan een overgebleven slot (same-kind gym of
  // cross-sport) = swap. KIND_ORDER maakt sub-pass 2 deterministisch (gym vóór run/padel).
  for (const date of dates) {
    const dayComps = comps
      .filter((c) => c.date === date)
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    const daySlots = slots.filter((s) => s.plannedDate === date)

    for (const c of dayComps) {
      if (c.used) continue
      const slot = daySlots.find(
        (s) =>
          !s.fulfilled && s.kind === c.kind && (c.kind !== 'gym' || titlesMatch(s.focus, c.title)),
      )
      if (slot) {
        slot.fulfilled = true
        c.used = true
        items.push(makeDoneItem(slot, c, 'done-as-planned', date))
      }
    }

    for (const c of dayComps) {
      if (c.used) continue
      const slot =
        daySlots.find((s) => !s.fulfilled && s.kind === c.kind) ??
        daySlots.find((s) => !s.fulfilled)
      if (slot) {
        slot.fulfilled = true
        c.used = true
        items.push(makeDoneItem(slot, c, 'done-swap', date))
      }
    }
  }

  // ── Step B: cross-day rescue (soepel tellen op sport) ──
  // Pass 1 (gym op gelijke titel) eerst, over alle slots, zodat titels netjes op hun
  // eigen slot landen (geen vroege slot die andermans titel-match wegkaapt).
  for (const slot of slots) {
    if (slot.fulfilled || slot.kind !== 'gym') continue
    const c = comps.find((x) => !x.used && x.kind === 'gym' && titlesMatch(slot.focus, x.title))
    if (c) {
      slot.fulfilled = true
      c.used = true
      items.push(makeDoneItem(slot, c, 'done-as-planned', c.date, slot.plannedDate))
    }
  }
  // Pass 2 (soepel): elke nog-open slot krijgt een nog-vrije sessie van hetzelfde
  // soort, ergens in de week. Gym zonder titel-match = swap; run/padel = as-planned
  // (hun titel is generiek). Zo telt elke kracht-sessie voor een geplande kracht-dag.
  for (const slot of slots) {
    if (slot.fulfilled) continue
    const c = comps.find((x) => !x.used && x.kind === slot.kind)
    if (c) {
      slot.fulfilled = true
      c.used = true
      const asPlanned = slot.kind !== 'gym' || titlesMatch(slot.focus, c.title)
      items.push(makeDoneItem(slot, c, asPlanned ? 'done-as-planned' : 'done-swap', c.date, slot.plannedDate))
    }
  }

  // ── Resterende planned ──
  for (const slot of slots) {
    if (slot.fulfilled) continue
    const state: ReconciledState =
      slot.plannedDate < today ? 'missed' : slot.plannedDate === today ? 'planned-today' : 'planned'
    items.push({
      kind: slot.kind,
      state,
      displayDate: slot.plannedDate,
      title: slot.focus,
      plannedDate: slot.plannedDate,
      plannedFocus: slot.focus,
      plannedExercises: slot.exercises,
      subtitle: slot.subtitle,
      durationMin: slot.durationMin,
    })
  }

  // ── Resterende completions = extra ──
  for (const c of comps) {
    if (c.used) continue
    items.push({
      kind: c.kind,
      state: 'done-extra',
      displayDate: c.date,
      title: c.title,
      actualDate: c.date,
      completionId: c.id,
      durationSeconds: c.durationSeconds,
      startedAt: c.startedAt,
      distanceMeters: c.distanceMeters,
      actualExercises: c.exercises,
    })
  }

  return items
}
