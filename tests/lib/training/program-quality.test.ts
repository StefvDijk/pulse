import { describe, expect, it } from 'vitest'
import { auditProgramProposal, type ExerciseMetadata } from '@/lib/training/program-quality'

const metadata: Record<string, ExerciseMetadata> = {
  'barbell bench press': {
    name: 'Barbell Bench Press',
    primary_muscle_group: 'chest',
    movement_pattern: 'horizontal_push',
  },
  'chest-supported row': {
    name: 'Chest-Supported Row',
    primary_muscle_group: 'upper_back',
    movement_pattern: 'horizontal_pull',
  },
  'lat pulldown': {
    name: 'Lat Pulldown',
    primary_muscle_group: 'lats',
    movement_pattern: 'vertical_pull',
  },
  'face pull': {
    name: 'Face Pull',
    primary_muscle_group: 'rotator_cuff',
    movement_pattern: 'horizontal_pull',
  },
  'pallof press': {
    name: 'Pallof Press',
    primary_muscle_group: 'core',
    movement_pattern: 'core',
  },
  'bulgarian split squat': {
    name: 'Bulgarian Split Squat',
    primary_muscle_group: 'quads',
    movement_pattern: 'lunge',
  },
}

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Audit Test',
    schema_type: 'upper_lower',
    weeks_planned: 4,
    start_date: '2026-06-01',
    workout_schedule: [
      {
        day: 'monday',
        focus: 'Upper A',
        sport_type: 'gym',
        duration_min: 55,
        exercises: [
          ex('Barbell Bench Press', 3),
          ex('Chest-Supported Row', 4),
          ex('Lat Pulldown', 3),
          ex('Face Pull', 2),
          ex('Pallof Press', 2),
        ],
      },
      {
        day: 'tuesday',
        focus: 'Easy run',
        sport_type: 'run',
        run_type: 'easy',
        duration_min: 35,
        exercises: [],
      },
    ],
    progression: {
      protocol: 'double_progression',
      deload_week: 4,
      deload_strategy: 'volume',
      overload_increment_kg: 2.5,
    },
    coach_rationale: ['a', 'b', 'c', 'd', 'e'],
    ...overrides,
  }
}

function ex(name: string, sets = 3) {
  return {
    name,
    sets,
    reps: '8-10',
    rest_seconds: 90,
    rpe: '8',
    notes: 'Startgewicht conservatief, ophogen bij top range.',
  }
}

describe('auditProgramProposal', () => {
  it('blocks overhead press variants', () => {
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [ex('Dumbbell Shoulder Press'), ex('Chest-Supported Row'), ex('Face Pull'), ex('Pallof Press')],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'overhead_press' && i.severity === 'blocker')).toBe(true)
  })

  it('blocks BSS directly after interval run', () => {
    const p = proposal({
      workout_schedule: [
        { day: 'monday', focus: 'Intervals', sport_type: 'run', run_type: 'interval', duration_min: 35, exercises: [] },
        {
          day: 'tuesday',
          focus: 'Lower A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [ex('Bulgarian Split Squat'), ex('Chest-Supported Row'), ex('Face Pull'), ex('Pallof Press')],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'bss_after_interval' && i.severity === 'blocker')).toBe(true)
  })

  it('blocks push sets greater than pull sets', () => {
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [ex('Barbell Bench Press', 8), ex('Chest-Supported Row', 2), ex('Face Pull'), ex('Pallof Press')],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'push_gt_pull' && i.severity === 'blocker')).toBe(true)
  })

  it('warns for sessions over 55 minutes', () => {
    const audit = auditProgramProposal(proposal({ workout_schedule: [{ ...proposal().workout_schedule[0], duration_min: 62 }] }), {
      exerciseMetadata: metadata,
    })
    expect(audit.items.some((i) => i.code === 'session_too_long' && i.severity === 'warning')).toBe(true)
  })

  it('blocks missing deload when >= 4 weeks planned', () => {
    const p = proposal({
      progression: {
        protocol: 'double_progression',
        deload_week: undefined,
        deload_strategy: 'volume',
        overload_increment_kg: 2.5,
      },
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.hasBlockers).toBe(true)
    // deload_week is required by schema, so contract_invalid fires
    expect(audit.items.some((i) => i.severity === 'blocker')).toBe(true)
  })

  it('blocks deload_week out of range (> weeks_planned)', () => {
    const p = proposal({
      weeks_planned: 4,
      progression: {
        protocol: 'double_progression',
        deload_week: 6,
        deload_strategy: 'volume',
        overload_increment_kg: 2.5,
      },
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'deload_out_of_range' && i.severity === 'blocker')).toBe(true)
    expect(audit.hasBlockers).toBe(true)
  })

  it('blocks when no core-stability exercise is present', () => {
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [ex('Barbell Bench Press', 3), ex('Chest-Supported Row', 4), ex('Face Pull', 2)],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'missing_core' && i.severity === 'blocker')).toBe(true)
  })

  it('blocks upper-day without prehab exercises', () => {
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [ex('Barbell Bench Press', 3), ex('Chest-Supported Row', 4), ex('Pallof Press', 2)],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'missing_upper_prehab' && i.severity === 'blocker')).toBe(true)
  })

  it('blocks duplicate days in schedule', () => {
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [ex('Barbell Bench Press', 3), ex('Chest-Supported Row', 4), ex('Face Pull', 2), ex('Pallof Press', 2)],
        },
        {
          day: 'monday',
          focus: 'Upper B',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [ex('Barbell Bench Press', 3), ex('Chest-Supported Row', 4), ex('Face Pull', 2), ex('Pallof Press', 2)],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'duplicate_day' && i.severity === 'blocker')).toBe(true)
  })

  it('blocks projected ACWR > 1.5 with enough load history', () => {
    const p = proposal()
    const audit = auditProgramProposal(p, {
      exerciseMetadata: metadata,
      projectedACWR: 1.7,
      hasEnoughLoadHistory: true,
    })
    expect(audit.items.some((i) => i.code === 'acwr_red' && i.severity === 'blocker')).toBe(true)
    expect(audit.hasBlockers).toBe(true)
  })

  it('warns projected ACWR > 1.5 with limited load history', () => {
    const p = proposal()
    const audit = auditProgramProposal(p, {
      exerciseMetadata: metadata,
      projectedACWR: 1.7,
      hasEnoughLoadHistory: false,
    })
    const item = audit.items.find((i) => i.code === 'acwr_red_low_history')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
    // Should NOT be a blocker
    expect(audit.items.some((i) => i.code === 'acwr_red')).toBe(false)
  })

  it('warns when projected ACWR is in amber zone (1.3-1.5)', () => {
    const p = proposal()
    const audit = auditProgramProposal(p, {
      exerciseMetadata: metadata,
      projectedACWR: 1.35,
      hasEnoughLoadHistory: true,
    })
    const item = audit.items.find((i) => i.code === 'acwr_amber')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
  })

  it('warns when muscle volume is outside MEV-MRV range', () => {
    // chest MEV=8, give only 2 sets -> below MEV
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Barbell Bench Press', 2),
            ex('Chest-Supported Row', 4),
            ex('Lat Pulldown', 3),
            ex('Face Pull', 2),
            ex('Pallof Press', 2),
          ],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    const item = audit.items.find(
      (i) => i.code === 'muscle_volume_out_of_range' && i.meta?.muscle === 'chest',
    )
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
  })

  it('warns when exercise rotation is < 30% vs previous block', () => {
    // All exercises are the same as previous block -> 0% rotation
    const previousSchedule = [
      {
        day: 'monday' as const,
        focus: 'Upper A',
        sport_type: 'gym' as const,
        duration_min: 55,
        exercises: [
          ex('Barbell Bench Press', 3),
          ex('Chest-Supported Row', 4),
          ex('Lat Pulldown', 3),
          ex('Face Pull', 2),
          ex('Pallof Press', 2),
        ],
      },
    ]
    const p = proposal()
    const audit = auditProgramProposal(p, {
      exerciseMetadata: metadata,
      previousSchedule,
    })
    const item = audit.items.find((i) => i.code === 'low_rotation')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
    expect(item!.meta?.rotationPct).toBeLessThan(30)
  })

  it('warns when no unilateral lower-body exercise is present', () => {
    // Default proposal has no lower-body exercises at all, but let's be explicit
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Lower A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Barbell Back Squat', 4),
            ex('Romanian Deadlift', 3),
            ex('Leg Press', 3),
            ex('Pallof Press', 2),
          ],
        },
      ],
    })
    // Add metadata for lower-body exercises
    const extendedMetadata = {
      ...metadata,
      'barbell back squat': {
        name: 'Barbell Back Squat',
        primary_muscle_group: 'quads',
        movement_pattern: 'squat',
      },
      'romanian deadlift': {
        name: 'Romanian Deadlift',
        primary_muscle_group: 'hamstrings',
        movement_pattern: 'hinge',
      },
      'leg press': {
        name: 'Leg Press',
        primary_muscle_group: 'quads',
        movement_pattern: 'squat',
      },
    }
    const audit = auditProgramProposal(p, { exerciseMetadata: extendedMetadata })
    expect(audit.items.some((i) => i.code === 'missing_unilateral' && i.severity === 'warning')).toBe(true)
  })

  it('warns when muscle frequency is < 2x per week', () => {
    // Only one session with chest -> frequency = 1
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Barbell Bench Press', 3),
            ex('Chest-Supported Row', 4),
            ex('Lat Pulldown', 3),
            ex('Face Pull', 2),
            ex('Pallof Press', 2),
          ],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    const item = audit.items.find(
      (i) => i.code === 'low_frequency' && i.meta?.muscle === 'chest',
    )
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
  })

  it('warns when push/pull ratio exceeds 2:1', () => {
    // Need push > 2x pull but push <= pull (no push_gt_pull blocker)
    // Actually push_pull_skew triggers when pushSets / pullSets > 2
    // AND push_gt_pull triggers when pushSets > pullSets
    // So push_gt_pull will also fire. Both can coexist.
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Barbell Bench Press', 10),
            ex('Chest-Supported Row', 3),
            ex('Face Pull', 1),
            ex('Pallof Press', 2),
          ],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    // push = 10, pull = 3 + 1 = 4, ratio = 2.5:1
    expect(audit.items.some((i) => i.code === 'push_pull_skew' && i.severity === 'warning')).toBe(true)
  })

  it('warns when exercises cannot be matched to metadata', () => {
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Chest-Supported Row', 4),
            ex('Face Pull', 2),
            ex('Pallof Press', 2),
            ex('Some Obscure Exercise', 3),
          ],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.items.some((i) => i.code === 'unknown_exercise_metadata' && i.severity === 'warning')).toBe(true)
  })

  it('blocks on invalid contract input', () => {
    const audit = auditProgramProposal(null, { exerciseMetadata: metadata })
    expect(audit.hasBlockers).toBe(true)
    expect(audit.items.some((i) => i.code === 'contract_invalid' && i.severity === 'blocker')).toBe(true)
  })

  it('blocks on contract with missing required fields', () => {
    const audit = auditProgramProposal({ title: 'Incomplete' }, { exerciseMetadata: metadata })
    expect(audit.hasBlockers).toBe(true)
    expect(audit.items.every((i) => i.code === 'contract_invalid')).toBe(true)
  })

  it('passes a valid well-formed proposal with no blockers', () => {
    const p = proposal({
      workout_schedule: [
        {
          day: 'monday',
          focus: 'Upper A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Barbell Bench Press', 3),
            ex('Chest-Supported Row', 4),
            ex('Lat Pulldown', 3),
            ex('Face Pull', 2),
            ex('Pallof Press', 2),
          ],
        },
        {
          day: 'wednesday',
          focus: 'Lower A',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Bulgarian Split Squat', 3),
            ex('Chest-Supported Row', 4),
            ex('Lat Pulldown', 3),
            ex('Face Pull', 2),
            ex('Pallof Press', 2),
          ],
        },
        {
          day: 'friday',
          focus: 'Upper B',
          sport_type: 'gym',
          duration_min: 55,
          exercises: [
            ex('Barbell Bench Press', 3),
            ex('Chest-Supported Row', 4),
            ex('Lat Pulldown', 3),
            ex('Face Pull', 2),
            ex('Pallof Press', 2),
          ],
        },
      ],
    })
    const audit = auditProgramProposal(p, { exerciseMetadata: metadata })
    expect(audit.hasBlockers).toBe(false)
    // Only info-level items and possibly warnings for volume/frequency, but no blockers
    const blockers = audit.items.filter((i) => i.severity === 'blocker')
    expect(blockers).toHaveLength(0)
  })
})
