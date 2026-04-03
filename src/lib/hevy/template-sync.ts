import { createAdminClient } from '@/lib/supabase/admin'
import { getExerciseTemplates } from '@/lib/hevy/client'
import { searchExerciseImage } from '@/lib/wger/client'
import type { HevyExerciseTemplate } from '@/lib/hevy/types'

// ---------------------------------------------------------------------------
// Hevy → DB enum mappings
// ---------------------------------------------------------------------------

const MUSCLE_GROUP_MAP: Record<string, string> = {
  abdominals: 'core',
  abductors: 'hip_flexors',
  adductors: 'hip_flexors',
  biceps: 'biceps',
  calves: 'calves',
  cardio: 'core',
  chest: 'chest',
  forearms: 'forearms',
  full_body: 'core',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  lower_back: 'core',
  neck: 'core',
  other: 'core',
  quadriceps: 'quads',
  quads: 'quads',
  shoulders: 'shoulders',
  traps: 'upper_back',
  triceps: 'triceps',
  upper_back: 'upper_back',
}

const EQUIPMENT_MAP: Record<string, string> = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  kettlebell: 'kettlebell',
  machine: 'machine',
  none: 'bodyweight',
  other: 'other',
  plate: 'other',
  resistance_band: 'band',
  suspension: 'bodyweight',
  cable: 'cable',
  bodyweight: 'bodyweight',
  band: 'band',
}

// Infer movement pattern from mapped muscle group
function inferMovementPattern(muscleGroup: string): string {
  const patterns: Record<string, string> = {
    chest: 'horizontal_push',
    shoulders: 'vertical_push',
    triceps: 'isolation',
    upper_back: 'horizontal_pull',
    lats: 'vertical_pull',
    biceps: 'isolation',
    forearms: 'isolation',
    quads: 'squat',
    hamstrings: 'hinge',
    glutes: 'hinge',
    calves: 'isolation',
    core: 'core',
    hip_flexors: 'isolation',
    rotator_cuff: 'isolation',
  }
  return patterns[muscleGroup] ?? 'isolation'
}

function mapMuscleGroup(hevyGroup: string | null): string {
  if (!hevyGroup) return 'core'
  return MUSCLE_GROUP_MAP[hevyGroup.toLowerCase()] ?? 'core'
}

function mapEquipment(hevyEquipment: string | null | undefined): string | null {
  if (!hevyEquipment) return null
  return EQUIPMENT_MAP[hevyEquipment.toLowerCase()] ?? 'other'
}

function mapSecondaryMuscleGroups(groups: string[] | null): string[] {
  if (!groups) return []
  return groups.map((g) => MUSCLE_GROUP_MAP[g.toLowerCase()] ?? 'core')
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export interface TemplateSyncResult {
  synced: number
  errors: string[]
}

export async function syncExerciseTemplates(
  apiKey: string,
): Promise<TemplateSyncResult> {
  const admin = createAdminClient()
  const errors: string[] = []
  let synced = 0

  // 1. Fetch all exercise templates from Hevy
  let templates: HevyExerciseTemplate[]
  try {
    templates = await getExerciseTemplates(apiKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { synced: 0, errors: [`Failed to fetch exercise templates: ${message}`] }
  }

  // 2. Map and upsert in batches
  const BATCH_SIZE = 50
  for (let i = 0; i < templates.length; i += BATCH_SIZE) {
    const batch = templates.slice(i, i + BATCH_SIZE)

    const inserts = batch.map((template) => {
      const primaryMuscle = mapMuscleGroup(template.primary_muscle_group)
      return {
        hevy_exercise_id: template.id,
        name: template.title,
        primary_muscle_group: primaryMuscle,
        secondary_muscle_groups: mapSecondaryMuscleGroups(template.secondary_muscle_groups),
        movement_pattern: inferMovementPattern(primaryMuscle),
        equipment: mapEquipment(template.equipment),
        is_compound: false, // Hevy doesn't provide this; default to false
      }
    })

    const { error } = await admin
      .from('exercise_definitions')
      .upsert(inserts, { onConflict: 'name' })

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
    } else {
      synced += batch.length
    }
  }

  // 3. Fetch wger images for exercises that don't have one yet
  const { data: missingImages } = await admin
    .from('exercise_definitions')
    .select('id, name')
    .is('image_url', null)
    .limit(50) // Process in small batches to avoid long sync times

  if (missingImages && missingImages.length > 0) {
    for (const exercise of missingImages) {
      try {
        const imageUrl = await searchExerciseImage(exercise.name)
        if (imageUrl) {
          await admin
            .from('exercise_definitions')
            .update({ image_url: imageUrl })
            .eq('id', exercise.id)
        }
      } catch {
        // Non-critical: skip image fetch failures silently
      }
    }
  }

  return { synced, errors }
}
