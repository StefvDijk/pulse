import type { ProgramProposalV2, ProgramSession } from './program-contract'
import { ProgramProposalV2Schema } from './program-contract'

export type AuditSeverity = 'blocker' | 'warning' | 'info'

export interface AuditItem {
  severity: AuditSeverity
  code: string
  message: string
  path?: string
  meta?: Record<string, unknown>
}

export interface ProgramAudit {
  items: AuditItem[]
  hasBlockers: boolean
}

export interface ExerciseMetadata {
  name: string
  primary_muscle_group: string
  secondary_muscle_groups?: string[] | null
  movement_pattern: string
}

export interface ProgramAuditContext {
  previousSchedule?: ProgramSession[]
  currentACWR?: number | null
  projectedACWR?: number | null
  hasEnoughLoadHistory?: boolean
  injuries?: Array<{ bodyLocation?: string; body_location?: string; status?: string; description?: string | null }>
  exerciseMetadata?: Record<string, ExerciseMetadata>
}

const DAY_INDEX: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
}

const CORE_RE = /\b(dead bug|deadbug|pallof|plank|side plank|hollow hold|anti[- ]rotation)\b/i
const PREHAB_RE = /\b(face pull|band pull[- ]?apart|pull apart|external rotation|rear delt|reverse fly)\b/i
const OVERHEAD_PRESS_RE =
  /\b(overhead press|ohp|shoulder press|military press|arnold press|db press|dumbbell press)\b/i
const BSS_RE = /\b(bulgarian split squat|bss|rear foot elevated split squat)\b/i
const UNILATERAL_RE =
  /\b(split squat|bulgarian|single[- ]leg|lunge|step[- ]up|cossack|rear foot elevated)\b/i

const PUSH_PATTERNS = new Set(['horizontal_push', 'vertical_push'])
const PULL_PATTERNS = new Set(['horizontal_pull', 'vertical_pull'])

const VOLUME_RANGES: Record<string, { mev: number; mrv: number }> = {
  chest: { mev: 8, mrv: 22 },
  upper_back: { mev: 10, mrv: 26 },
  lats: { mev: 8, mrv: 24 },
  shoulders: { mev: 6, mrv: 20 },
  biceps: { mev: 4, mrv: 18 },
  triceps: { mev: 4, mrv: 18 },
  quads: { mev: 8, mrv: 22 },
  hamstrings: { mev: 6, mrv: 18 },
  glutes: { mev: 6, mrv: 20 },
  calves: { mev: 4, mrv: 18 },
  core: { mev: 4, mrv: 16 },
}

function add(items: AuditItem[], item: AuditItem) {
  items.push(item)
}

function normaliseName(name: string) {
  return name.toLowerCase().trim()
}

function metadataFor(
  exercise: { name: string; primary_muscle_group?: string; movement_pattern?: string },
  ctx: ProgramAuditContext,
): ExerciseMetadata | null {
  const fromExercise =
    exercise.primary_muscle_group && exercise.movement_pattern
      ? {
          name: exercise.name,
          primary_muscle_group: exercise.primary_muscle_group,
          movement_pattern: exercise.movement_pattern,
        }
      : null
  return ctx.exerciseMetadata?.[normaliseName(exercise.name)] ?? fromExercise
}

function gymSessions(proposal: ProgramProposalV2) {
  return proposal.workout_schedule.filter((s) => s.sport_type === 'gym')
}

function allExercises(proposal: ProgramProposalV2) {
  return gymSessions(proposal).flatMap((s, sessionIdx) =>
    s.exercises.map((e, exerciseIdx) => ({ ...e, session: s, sessionIdx, exerciseIdx })),
  )
}

function hasIntervalRunPreviousDay(session: ProgramSession, schedule: ProgramSession[]) {
  const prevIdx = (DAY_INDEX[session.day] + 6) % 7
  return schedule.some((s) => DAY_INDEX[s.day] === prevIdx && s.sport_type === 'run' && s.run_type === 'interval')
}

function ratioLabel(ratio: number) {
  return `${Math.round(ratio * 10) / 10}:1`
}

export function auditProgramProposal(
  rawProposal: unknown,
  ctx: ProgramAuditContext = {},
): ProgramAudit {
  const items: AuditItem[] = []
  const parsed = ProgramProposalV2Schema.safeParse(rawProposal)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      add(items, {
        severity: 'blocker',
        code: 'contract_invalid',
        message: `Schema-contract ongeldig: ${issue.message}`,
        path: issue.path.join('.'),
      })
    }
    return { items, hasBlockers: true }
  }

  const proposal = parsed.data
  const exercises = allExercises(proposal)

  const seenDays = new Set<string>()
  for (const [idx, session] of proposal.workout_schedule.entries()) {
    if (seenDays.has(session.day)) {
      add(items, {
        severity: 'blocker',
        code: 'duplicate_day',
        message: `Dubbele dag in schema: ${session.day}`,
        path: `workout_schedule.${idx}.day`,
      })
    }
    seenDays.add(session.day)
  }

  for (const item of exercises) {
    if (OVERHEAD_PRESS_RE.test(item.name)) {
      add(items, {
        severity: 'blocker',
        code: 'overhead_press',
        message: `Overhead press variant gevonden: ${item.name}`,
        path: `workout_schedule.${item.sessionIdx}.exercises.${item.exerciseIdx}.name`,
      })
    }
    if (BSS_RE.test(item.name) && hasIntervalRunPreviousDay(item.session, proposal.workout_schedule)) {
      add(items, {
        severity: 'blocker',
        code: 'bss_after_interval',
        message: `Bulgarian split squat staat direct na een interval-run (${item.session.day}).`,
        path: `workout_schedule.${item.sessionIdx}.exercises.${item.exerciseIdx}.name`,
      })
    }
  }

  if (proposal.weeks_planned >= 4 && !proposal.progression.deload_week) {
    add(items, {
      severity: 'blocker',
      code: 'missing_deload',
      message: 'Schema van 4+ weken mist een deload-week.',
      path: 'progression.deload_week',
    })
  }
  if (proposal.weeks_planned >= 4 && proposal.progression.deload_week > proposal.weeks_planned) {
    add(items, {
      severity: 'blocker',
      code: 'deload_out_of_range',
      message: `Deload week ${proposal.progression.deload_week} valt buiten ${proposal.weeks_planned} geplande weken.`,
      path: 'progression.deload_week',
    })
  }

  let pushSets = 0
  let pullSets = 0
  let unknownMetadata = 0
  const muscleSets = new Map<string, number>()
  const muscleFrequency = new Map<string, Set<string>>()
  let unilateralCount = 0

  for (const item of exercises) {
    const meta = metadataFor(item, ctx)
    if (!meta) {
      unknownMetadata++
      continue
    }
    if (PUSH_PATTERNS.has(meta.movement_pattern)) pushSets += item.sets
    if (PULL_PATTERNS.has(meta.movement_pattern)) pullSets += item.sets
    muscleSets.set(meta.primary_muscle_group, (muscleSets.get(meta.primary_muscle_group) ?? 0) + item.sets)
    const freq = muscleFrequency.get(meta.primary_muscle_group) ?? new Set<string>()
    freq.add(item.session.day)
    muscleFrequency.set(meta.primary_muscle_group, freq)
    if (meta.movement_pattern === 'lunge' || UNILATERAL_RE.test(item.name)) unilateralCount++
  }

  if (unknownMetadata > 0) {
    add(items, {
      severity: 'warning',
      code: 'unknown_exercise_metadata',
      message: `${unknownMetadata} oefening(en) konden niet aan exercise_definitions gekoppeld worden; volume-audit is minder betrouwbaar.`,
    })
  }

  if (pushSets > pullSets) {
    add(items, {
      severity: 'blocker',
      code: 'push_gt_pull',
      message: `Push sets (${pushSets}) zijn hoger dan pull sets (${pullSets}).`,
      meta: { pushSets, pullSets },
    })
  }

  const projected = ctx.projectedACWR ?? ctx.currentACWR ?? null
  const enoughLoadHistory = ctx.hasEnoughLoadHistory ?? true
  if (projected !== null) {
    if (projected > 1.5 && enoughLoadHistory) {
      add(items, {
        severity: 'warning',
        code: 'acwr_red',
        message: `Projected ACWR ${projected.toFixed(2)} is boven 1.50; start rustig en monitor herstel in week 1.`,
        meta: { projectedACWR: projected },
      })
    } else if (projected > 1.5) {
      add(items, {
        severity: 'warning',
        code: 'acwr_red_low_history',
        message: `Projected ACWR ${projected.toFixed(2)} is boven 1.50, maar load-historie is beperkt.`,
        meta: { projectedACWR: projected },
      })
    } else if (projected >= 1.3) {
      add(items, {
        severity: 'warning',
        code: 'acwr_amber',
        message: `Projected ACWR ${projected.toFixed(2)} zit in de gele zone.`,
        meta: { projectedACWR: projected },
      })
    }
  }

  if (!exercises.some((e) => CORE_RE.test(e.name))) {
    add(items, {
      severity: 'blocker',
      code: 'missing_core',
      message: 'Geen core-stability oefening gevonden (dead bugs, Pallof press of planks).',
    })
  }

  for (const [idx, session] of gymSessions(proposal).entries()) {
    const focus = session.focus.toLowerCase()
    const isUpper = focus.includes('upper') || focus.includes('push') || focus.includes('pull')
    if (isUpper && !session.exercises.some((e) => PREHAB_RE.test(e.name))) {
      add(items, {
        severity: 'blocker',
        code: 'missing_upper_prehab',
        message: `${session.focus} mist face pulls, band pull-aparts of vergelijkbare schouder-prehab.`,
        path: `workout_schedule.${idx}.exercises`,
      })
    }
  }

  for (const session of proposal.workout_schedule) {
    if (session.duration_min > 55) {
      add(items, {
        severity: 'warning',
        code: 'session_too_long',
        message: `${session.day} (${session.focus}) staat op ${session.duration_min} min.`,
      })
    }
  }

  if (ctx.previousSchedule && ctx.previousSchedule.length > 0) {
    const prevNames = new Set(
      ctx.previousSchedule.flatMap((s) => s.exercises ?? []).map((e) => normaliseName(e.name)),
    )
    const currentNames = exercises.map((e) => normaliseName(e.name))
    const rotated = currentNames.filter((name) => !prevNames.has(name)).length
    const rotationPct = currentNames.length > 0 ? Math.round((rotated / currentNames.length) * 100) : 0
    if (rotationPct < 30) {
      add(items, {
        severity: 'warning',
        code: 'low_rotation',
        message: `Oefening-rotatie is ${rotationPct}% vs vorig blok.`,
        meta: { rotationPct },
      })
    }
    add(items, {
      severity: 'info',
      code: 'rotation_pct',
      message: `Rotatie vs vorig blok: ${rotationPct}%.`,
      meta: { rotationPct },
    })
  }

  for (const [muscle, sets] of muscleSets) {
    const range = VOLUME_RANGES[muscle]
    if (range && (sets < range.mev || sets > range.mrv)) {
      add(items, {
        severity: 'warning',
        code: 'muscle_volume_out_of_range',
        message: `${muscle}: ${sets} sets/week buiten richtlijn (${range.mev}-${range.mrv}).`,
        meta: { muscle, sets, ...range },
      })
    }
  }

  if (pullSets > 0 && pushSets / pullSets > 2) {
    add(items, {
      severity: 'warning',
      code: 'push_pull_skew',
      message: `Push/pull ratio is scheef (${ratioLabel(pushSets / pullSets)}).`,
      meta: { pushSets, pullSets },
    })
  }

  if (unilateralCount === 0) {
    add(items, {
      severity: 'warning',
      code: 'missing_unilateral',
      message: 'Geen unilateral lower-body work gevonden.',
    })
  }

  for (const [muscle, days] of muscleFrequency) {
    if (muscle !== 'core' && days.size < 2) {
      add(items, {
        severity: 'warning',
        code: 'low_frequency',
        message: `${muscle} krijgt minder dan 2x frequentie per week.`,
        meta: { muscle, frequency: days.size },
      })
    }
  }

  add(items, {
    severity: 'info',
    code: 'deload_week',
    message: `Deload gepland in week ${proposal.progression.deload_week}.`,
    meta: { deloadWeek: proposal.progression.deload_week },
  })

  for (const [muscle, sets] of Array.from(muscleSets).sort(([a], [b]) => a.localeCompare(b))) {
    add(items, {
      severity: 'info',
      code: 'weekly_muscle_volume',
      message: `${muscle}: ${sets} sets/week.`,
      meta: { muscle, sets },
    })
  }

  return {
    items,
    hasBlockers: items.some((i) => i.severity === 'blocker'),
  }
}

export function hasBlockers(audit: ProgramAudit): boolean {
  return audit.hasBlockers
}
