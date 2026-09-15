import { z } from 'zod'
import { normalizeExerciseName } from './normalize'

/**
 * Zod schema for one record of hasaneyldrm/exercises-dataset. Only the fields
 * Pulse consumes are declared; Zod strips the rest (e.g. other-language
 * instructions). Mirrors data/exercises.schema.json.
 */
export const CatalogExerciseSchema = z.object({
  id: z.string().regex(/^[0-9]{4}$/),
  name: z.string().min(1),
  body_part: z.string().min(1),
  equipment: z.string().min(1),
  target: z.string().min(1),
  muscle_group: z.string().min(1),
  secondary_muscles: z.array(z.string()),
  instruction_steps: z.object({ en: z.array(z.string()) }),
  media_id: z.string().min(1),
  image: z.string().regex(/^images\/.+\.(jpg|jpeg|png)$/),
  gif_url: z.string().regex(/^videos\/.+\.gif$/),
  attribution: z.string().min(1),
})

export type CatalogExercise = z.infer<typeof CatalogExerciseSchema>

/** Insert shape for the `exercise_catalog` table (Task 1 columns). */
export interface CatalogRow {
  id: string
  name: string
  body_part: string
  equipment: string
  target: string
  muscle_group: string
  secondary_muscles: string[]
  instruction_steps: string[]
  media_id: string
  image_path: string
  gif_path: string
  attribution: string
  normalized_name: string
}

export function toCatalogRow(record: CatalogExercise): CatalogRow {
  return {
    id: record.id,
    name: record.name,
    body_part: record.body_part,
    equipment: record.equipment,
    target: record.target,
    muscle_group: record.muscle_group,
    secondary_muscles: record.secondary_muscles,
    instruction_steps: record.instruction_steps.en,
    media_id: record.media_id,
    image_path: record.image,
    gif_path: record.gif_url,
    attribution: record.attribution,
    normalized_name: normalizeExerciseName(record.name),
  }
}
