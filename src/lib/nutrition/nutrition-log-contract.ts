import { z } from 'zod'

// Zod contract for the chat <nutrition_log> write-back (audit #22). The meal
// description is re-analysed for macros by analyzeNutrition; we only guard the
// shape here so an empty or malformed payload doesn't silently trigger a
// macro-analysis call on nothing.
export const NutritionLogSchema = z.object({
  input: z.string().min(1).max(1000),
})

export type NutritionLogData = z.infer<typeof NutritionLogSchema>
