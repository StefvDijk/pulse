import { z } from 'zod'
import { tool } from 'ai'
import { getWorkoutHistory, getExerciseStats, searchExercises, comparePeriods } from './handlers/workout-tools'
import { getRunningHistory } from './handlers/running-tools'
import { getHealthMetrics } from './handlers/health-tools'
import { getNutritionLog, getMacroTargets } from './handlers/nutrition-tools'
import { calculateProgressiveOverload, getRecoveryScore } from './handlers/analysis-tools'
import {
  getBodyComposition,
  getActiveSchema,
  getInjuryHistory,
  getWeeklyAggregations,
} from './handlers/profile-tools'
import { createWritebackToolsForUser } from './writebacks'

// ---------------------------------------------------------------------------
// All tools available to the Pulse AI coach.
// Each tool uses AI SDK v6's `tool()` helper with Zod inputSchema.
// Handlers receive a `userId` via closure — see `createToolsForUser()`.
// ---------------------------------------------------------------------------

const workoutHistorySchema = z.object({
  period: z.enum(['today', 'this_week', 'last_week', 'this_month', 'last_month', 'last_3_months']).describe('Tijdsperiode'),
  include_sets: z.boolean().default(false).describe('Of individuele sets meegeleverd moeten worden. Zet op true voor gedetailleerde analyse'),
})

const exerciseStatsSchema = z.object({
  exercise_name: z.string().describe('Naam van de oefening (bijv. "DB Bench Press", "Lat Pulldown"). Gebruik de naam zoals opgeslagen in Hevy'),
  period: z.enum(['last_month', 'last_3_months', 'last_6_months', 'all_time']).default('last_3_months').describe('Tijdsperiode voor trends'),
})

const comparePeriodsSchema = z.object({
  period_a_start: z.string().describe('Start ISO datum van eerste (oudere) periode'),
  period_a_end: z.string().describe('Eind ISO datum van eerste periode'),
  period_b_start: z.string().describe('Start ISO datum van tweede (nieuwere) periode'),
  period_b_end: z.string().describe('Eind ISO datum van tweede periode'),
})

const runningHistorySchema = z.object({
  period: z.enum(['this_week', 'last_week', 'this_month', 'last_month', 'last_3_months']).describe('Tijdsperiode'),
  run_type: z.enum(['all', 'easy', 'tempo', 'interval', 'long', 'race']).default('all').describe('Filter op type run'),
})

const healthMetricsSchema = z.object({
  metrics: z.array(z.enum(['sleep', 'steps', 'resting_heart_rate', 'hrv', 'weight', 'active_energy'])).describe('Welke metrics op te halen'),
  period: z.enum(['today', 'this_week', 'last_week', 'this_month', 'last_month', 'last_3_months']).describe('Tijdsperiode'),
})

const nutritionLogSchema = z.object({
  period: z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month']).describe('Tijdsperiode'),
  include_meals: z.boolean().default(false).describe('Of individuele maaltijden meegeleverd moeten worden'),
})

const progressiveOverloadSchema = z.object({
  exercise_name: z.string().describe('Naam van de oefening'),
  recent_sessions: z.number().default(6).describe('Hoeveel recente sessies te analyseren'),
})

const recoveryScoreSchema = z.object({
  date: z.string().optional().describe('ISO datum waarvoor de score te berekenen. Default: vandaag'),
})

const searchExercisesSchema = z.object({
  query: z.string().describe('Zoekopdracht (naam of spiergroep)'),
  muscle_group: z.enum(['chest', 'lats', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core']).optional().describe('Optioneel filter op spiergroep'),
})

export function createToolsForUser(userId: string) {
  return {
    get_workout_history: tool({
      description: `Haal workout geschiedenis op uit Hevy. Gebruik bij vragen over gym sessies, trainingsfrequentie, of workout patronen.
Gebruik NIET voor hardlopen (gebruik get_running_history) of specifieke oefening-PR's (gebruik get_exercise_stats).
Returns: lijst van workouts met datum, type, duur, en oefeningen.`,
      inputSchema: workoutHistorySchema,
      execute: async (input) => getWorkoutHistory(userId, input),
    }),

    get_exercise_stats: tool({
      description: `Haal statistieken op voor een specifieke oefening. Gebruik bij vragen over progressie, PR's, of trends (bijv. "hoe gaat mijn bench press?").
Returns: PR's, progressie over tijd, gemiddeld gewicht/reps per sessie, en trend.`,
      inputSchema: exerciseStatsSchema,
      execute: async (input) => getExerciseStats(userId, input),
    }),

    compare_periods: tool({
      description: `Vergelijk twee tijdsperiodes voor training metrics. Gebruik bij "hoe doe ik vergeleken met vorige maand?" of "ben ik vooruitgegaan?".
Vergelijkt: trainingsfrequentie, totaal volume, running km, en consistentie.
Gebruik NIET voor individuele oefening progressie (gebruik get_exercise_stats).`,
      inputSchema: comparePeriodsSchema,
      execute: async (input) => comparePeriods(userId, input),
    }),

    get_running_history: tool({
      description: `Haal hardloopgeschiedenis op. Gebruik bij vragen over runs, tempo's, afstanden, of hardlooppatronen.
Returns: lijst van runs met datum, afstand, tempo, hartslag, type.
Gebruik NIET voor gym workouts (gebruik get_workout_history).`,
      inputSchema: runningHistorySchema,
      execute: async (input) => getRunningHistory(userId, input),
    }),

    get_health_metrics: tool({
      description: `Haal gezondheidsmetrics op uit Apple Health. Gebruik voor vragen over slaap, stappen, hartslag, HRV, gewicht, of lichaamsvet.
Returns: tijdreeks van de gevraagde metric(s) over de opgegeven periode.
Gebruik NIET voor workout-specifieke hartslag (die zit in workout/run data).`,
      inputSchema: healthMetricsSchema,
      execute: async (input) => getHealthMetrics(userId, input),
    }),

    get_nutrition_log: tool({
      description: `Haal voedingslog op. Gebruik bij vragen over macro's, calorieën, eetpatronen, of specifieke dagen.
Returns: dagelijkse macro-totalen (calorieën, eiwit, koolhydraten, vet) met targets en adherence.`,
      inputSchema: nutritionLogSchema,
      execute: async (input) => getNutritionLog(userId, input),
    }),

    get_macro_targets: tool({
      description: `Haal Stef's huidige macro targets op. Gebruik om te weten wat zijn doelen zijn qua calorieën en macro's.
Returns: dagelijkse targets voor calorieën, eiwit, koolhydraten, vet.`,
      inputSchema: z.object({}),
      execute: async () => getMacroTargets(userId),
    }),

    calculate_progressive_overload: tool({
      description: `Bereken progressive overload voor een oefening. Gebruik bij vragen of Stef sterker wordt, of voor suggesties voor de volgende sessie.
Berekent: volume progressie (sets x reps x gewicht), intensiteit trend, en geeft concrete suggestie.
Roep dit aan NA get_exercise_stats als je de ruwe data al hebt.`,
      inputSchema: progressiveOverloadSchema,
      execute: async (input) => calculateProgressiveOverload(userId, input),
    }),

    get_recovery_score: tool({
      description: `Bereken een recovery score op basis van slaap, HRV, rusthart, en trainingsbelasting. Gebruik bij "moet ik vandaag trainen?" of vragen over herstel.
Combineert: slaap kwaliteit, HRV trend, resting HR, en trainingsvolume afgelopen 3 dagen.
Returns: score 1-10, breakdown per factor, en advies (train hard / train licht / rust).`,
      inputSchema: recoveryScoreSchema,
      execute: async (input) => getRecoveryScore(userId, input),
    }),

    search_exercises: tool({
      description: `Zoek oefeningen in de database. Gebruik als Stef een oefening noemt die je niet herkent, of als je alternatieven wilt suggereren.
Returns: lijst van matching oefeningen met spiergroepen en type.`,
      inputSchema: searchExercisesSchema,
      execute: async (input) => searchExercises(userId, input),
    }),

    // [B7 — Sprint 3] Profile read tools. The system prompt's profile
    // sections will eventually be replaced by these (see B11).
    get_body_composition: tool({
      description: `Haal de laatste Inbody/Apple-Health body composition op + trend van de afgelopen entries.
Gebruik bij vragen als "hoe gaat mijn vetpercentage?", "weeg ik nog", of "spiermassa progressie".
Returns: laatste meting (gewicht, vet%, spiermassa, viscerale vet, water%, BMI) en trend.`,
      inputSchema: z.object({
        limit: z.number().int().min(1).max(60).default(12).describe('Aantal recente entries voor de trend (default 12).'),
      }),
      execute: async (input) => getBodyComposition(userId, input),
    }),

    get_active_schema: tool({
      description: `Haal het huidig ACTIEVE trainingsschema op.
Gebruik bij vragen over de huidige training-week, schema-inhoud, of bij twijfel of een oefening in het schema staat.
Returns: titel, type, weken-planned, workout_schedule (per dag), en eventuele scheduled_overrides van check-in.`,
      inputSchema: z.object({}),
      execute: async () => getActiveSchema(userId),
    }),

    get_injury_history: tool({
      description: `Haal de blessure-historie op (actieve + optioneel afgesloten).
Gebruik bij elk schema-advies, en wanneer Stef terugkomt op een eerdere klacht.
Returns: lijst van injury_logs met locatie, severity, beschrijving, status.`,
      inputSchema: z.object({
        include_resolved: z.boolean().default(false).describe('Of afgesloten blessures meegeleverd moeten worden.'),
        limit: z.number().int().min(1).max(200).default(50),
      }),
      execute: async (input) => getInjuryHistory(userId, input),
    }),

    get_weekly_aggregations: tool({
      description: `Haal week-aggregaties op (workouts, volume, hardloop km, slaap, voeding, rusthart).
Gebruik bij weekly-review vragen of trend-analyses ("hoe doe ik vs vorige weken?").
Returns: array van weken (recentste eerst) met de belangrijkste metrics.`,
      inputSchema: z.object({
        weeks_back: z.number().int().min(1).max(52).default(8),
      }),
      execute: async (input) => getWeeklyAggregations(userId, input),
    }),

    // [B3 + A11 + D4 — Sprint 3] Write-back tools. Zod-validated, no XML.
    ...createWritebackToolsForUser(userId),
  }
}

export type PulseTools = ReturnType<typeof createToolsForUser>
export type PulseToolName = keyof PulseTools
