import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

// ---------------------------------------------------------------------------
// Stef's baseline profile — extracted from chat-system.ts (sections 2, 3, 5,
// 9, 10, 11). Migrating these into user_profile makes them editable + lets
// future check-ins update them rather than requiring a code change.
// ---------------------------------------------------------------------------

export const STEF_PROFILE = {
  basics: {
    age: 32,
    height_cm: 182,
    location: 'Amsterdam',
    work: 'Business analyst bij Hienfeld',
    diet: 'Grotendeels vegetarisch',
    schedule_pattern: 'Hybrid: kantoor di-do, thuis ma/vr. Gym 06:30',
  },
  recurring_habits: [
    { label: 'Fietsen kantoor', frequency: 'wekelijks', days: ['di', 'do'], notes: '~14km retour' },
  ],
  injuries: [
    {
      location: 'Rechter schouder',
      status: 'actief',
      restrictions: ['Geen overhead pressing (geen OHP/DB shoulder press)', 'Geen single arm cable row', 'Beperkte externe rotatie'],
      notes: 'Verdenking intra-articulaire/labrumpathologie. MRI-arthrogram referral pending. Chest-supported DB row als alternatief. Face pulls en push-ups: pijnvrij.',
    },
    {
      location: 'Knieën (beide)',
      status: 'chronisch',
      restrictions: ['Squats tot parallel, niet diep', 'BSS niet na intervaltraining (min 1 dag tussen)', 'Leg press: beperkt bereik'],
      notes: 'OCD beide knieën, kraakbeentransplantatie 2016',
    },
    {
      location: 'Onderrug',
      status: 'managed',
      restrictions: ['RDLs met neutrale rug, initiatie vanuit heupen'],
      notes: 'Gerelateerd aan langdurig zitten + heupflexor-stijfheid. Dead bugs, Pallof press, planks in schema houden.',
    },
  ],
  nutrition_targets: {
    protein_g_per_day: 140,
    kcal_training: 2100,
    kcal_rest: null,
    structure_notes: [
      'Ontbijt: Upfront Eiwit Oats + whey + creatine',
      'Lunch: 400g kwark + toppings',
      'Snack: kwark/skyr/eiwitreep rotatie',
      'Avondeten: eiwitrijk vegetarisch',
    ],
    supplements: ['Creatine (dagelijks)', 'Electrolytes na runs/padel'],
    weak_spots: ['Weekenden — alcohol + minder structuur'],
  },
  training_response: [
    { lesson: 'BSS niet na intervals (kniestress)', learned_at: '2026-03-01' },
    { lesson: 'Eten min 2 uur voor een run (maagklachten)', learned_at: '2026-03-01' },
    { lesson: 'Creatine dagelijks, niet alleen op trainingsdagen', learned_at: '2026-03-01' },
    { lesson: 'Electrolytes na runs en padel, niet na gym', learned_at: '2026-03-01' },
    { lesson: 'Verzadigingsformule: volume + eiwit + vezels', learned_at: '2026-03-01' },
    { lesson: 'Eiwitarme snacks lossen middaghonger niet op', learned_at: '2026-03-01' },
    { lesson: 'Twee gymdagen achter elkaar kan (bewezen wk2, geen herstelprobleem)', learned_at: '2026-03-15' },
    { lesson: '30 minuten slechte training > thuisblijven', learned_at: '2026-03-15' },
  ],
  gym_location: 'Train More, Piet Heinkade',
  barometer_exercises: [
    { exercise: 'Push-ups (set 1)', baseline: '8', current: '20 (wk4)', target: '25+ of elevated feet', status: 'doel wk4 gehaald' },
    { exercise: 'Plank (set 1)', baseline: '1:00', current: '1:35 (wk4)', target: '2:00+', status: 'doel wk4 gehaald' },
    { exercise: 'Pull-ups', baseline: '0', current: '0', target: '1 echte (of negatief >8s)', status: 'elke 2 weken testen' },
    { exercise: 'DB Bench Press', baseline: '10kg', current: '16kg (wk4)', target: '18-20kg x 10', status: 'lopend' },
    { exercise: 'Goblet Squat', baseline: '10kg', current: '16kg (wk4)', target: '20kg x 10 (→ barbell)', status: 'lopend' },
    { exercise: 'Lat Pulldown', baseline: '25kg', current: '40kg (wk4)', target: '45kg x 10', status: 'lopend' },
    { exercise: 'RDL (per hand)', baseline: '10kg', current: '~14kg (wk4)', target: '18-20kg x 10', status: 'lopend' },
  ],
  body_composition_notes:
    'InBody baseline 5 mrt 2026: 77.4kg / 34.7kg spier / 15.7kg vet / 20.2% / BMI 23.4. ' +
    'Scan 2 (23 mrt): 79.1kg / 36.1kg / 15.4kg / 19.4% / BMI 23.9 — gewichtstoename deels creatine-waterretentie; ' +
    'vetmassadaling -0.3kg is het schonere signaal. Doel: ~16-17% vetpercentage. ' +
    'Startmetingen 23 feb: buik 94cm, borst 92cm, bovenarm rechts 26cm, bovenbeen rechts 58.5cm.',
}

export async function seedStefProfile(
  userId: string,
  force: boolean = false,
): Promise<{ seeded: boolean; skipped: boolean }> {
  const admin = createAdminClient()

  if (!force) {
    const { data: existing } = await admin
      .from('user_profile')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) return { seeded: false, skipped: true }
  }

  const { error } = await admin.from('user_profile').upsert({
    user_id: userId,
    basics: STEF_PROFILE.basics as unknown as Json,
    recurring_habits: STEF_PROFILE.recurring_habits as unknown as Json,
    injuries: STEF_PROFILE.injuries as unknown as Json,
    nutrition_targets: STEF_PROFILE.nutrition_targets as unknown as Json,
    training_response: STEF_PROFILE.training_response as unknown as Json,
    gym_location: STEF_PROFILE.gym_location,
    barometer_exercises: STEF_PROFILE.barometer_exercises as unknown as Json,
    body_composition_notes: STEF_PROFILE.body_composition_notes,
  })

  if (error) throw error
  return { seeded: true, skipped: false }
}
