import { describe, it, expect } from 'vitest'
import { buildBlockReviewPrompt } from '@/lib/ai/prompts/block-review'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '@/components/block-review/types'

const minimalData: BlockReviewData = {
  schema: {
    id: 'schema-1',
    title: 'Test Schema',
    schemaType: 'upper_lower',
    weeksPlanned: 8,
    workoutsPerWeek: 4,
    startDate: '2026-03-01',
    endDate: '2026-04-26',
  },
  totals: {
    completedSessions: 28,
    plannedSessions: 32,
    adherencePct: 87,
    gymSessions: 28,
    runs: 6,
    runKm: 42,
    padelSessions: 2,
    totalTonnageKg: 82000,
  },
  templateAdherence: [],
  exerciseProgressions: [],
  bodyDelta: {
    weightKg: 80,
    skeletalMuscleMassKg: 38,
    fatMassKg: 12,
    fatPct: 15,
  },
  wellnessAverages: { feeling: 4, sleepQuality: 3.8, checkinCount: 12 },
  injuries: [],
  goals: [],
  journey: {
    journeyStart: '2026-02-01',
    daysActive: 110,
    lifetimeTotals: {
      totalWorkouts: 50,
      totalRuns: 12,
      totalRunKm: 85,
      totalPadelSessions: 4,
      totalTonnageKg: 150000,
    },
    priorSchemas: [],
    bodyJourney: [],
    bodyBaselineToNow: {
      weightKgDelta: null,
      skeletalMuscleMassKgDelta: null,
      fatMassKgDelta: null,
      fatPctDelta: null,
      waistCmDelta: null,
    },
    liftJourney: [],
    lifetimePRs: [],
    coachingMemory: [],
    weeklyLessons: [],
    recentWeeklyReviews: [],
    userProfile: null,
    customInstructions: null,
    proteinTargetPerKg: null,
    coachTone: null,
  },
} as unknown as BlockReviewData

const minimalForm: BlockReviewFormState = {
  reflection: {
    templateRatings: [],
    keepExercises: [],
    dropExercises: [],
    biggestWin: '',
    biggestMiss: '',
    injuryUpdates: {},
  },
  newInBody: null,
  conversation: [],
  aiAnalysis: '',
  aiSchemaProposal: null,
  schemaProposalVersion: 0,
  selectedGoals: [],
  endReason: 'completed',
}

describe('buildBlockReviewPrompt', () => {
  it('returns an object with system and user strings', () => {
    const result = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [],
    })
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
    expect(result.system.length).toBeGreaterThan(500)
    expect(result.user.length).toBeGreaterThan(100)
  })

  it('puts coach-core persona + knowledge + werkwijze in system', () => {
    const { system } = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [],
    })
    expect(system).toMatch(/wijze expert/i)        // persona
    expect(system).toMatch(/MEV.*MAV.*MRV/i)        // knowledge
    expect(system).toMatch(/\[NU VRAGEN\]/)         // werkwijze
    expect(system).toMatch(/block_proposal/i)       // werkwijze
  })

  it('puts journey + dit-blok + reflectie + transcript in user', () => {
    const { user } = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [{ role: 'user', content: 'hoi' }],
    })
    expect(user).toMatch(/JOURNEY/i)
    expect(user).toMatch(/DIT BLOK/i)
    expect(user).toMatch(/REFLECTIE/i)
    expect(user).toMatch(/hoi/)                     // transcript present
  })

  it('first-turn user block signals geen gesprek yet', () => {
    const { user } = buildBlockReviewPrompt({
      data: minimalData,
      form: minimalForm,
      conversation: [],
    })
    expect(user).toMatch(/eerste beurt|nog geen gesprek/i)
  })
})
