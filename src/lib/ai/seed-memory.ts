import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Baseline coaching memory — seeded from kennisbank (23 feb – 2 apr 2026)
// These 38 facts were established over 31 coaching conversations and represent
// the foundational knowledge the AI coach needs from day 1.
// ---------------------------------------------------------------------------

interface MemoryEntry {
  key: string
  category: 'program' | 'lifestyle' | 'injury' | 'preference' | 'pattern' | 'goal'
  value: string
  source_date: string
}

const BASELINE_MEMORY: MemoryEntry[] = [
  // ─── PROGRAM ────────────────────────────────────────────────────────────
  {
    key: 'active_schema_week5_8',
    category: 'program',
    value: 'Week 5-8 upper/lower 4x split actief (gestart 30 mrt 2026). Upper A ma, Lower A di, Upper B wo, Lower B do, run vr',
    source_date: '2026-03-30',
  },
  {
    key: 'week5_8_start_weights',
    category: 'program',
    value: 'Startgewichten week 5: bench 16kg, goblet squat 16kg, lat pulldown 40kg, RDL 14-16kg/hand, leg press 90kg',
    source_date: '2026-03-30',
  },
  {
    key: 'runna_plan_status',
    category: 'program',
    value: 'Runna 8w Functional Fitness afgerond (16 feb – 11 apr). Hardlopen nu onderhoudsmodus: 1x/week easy run 30-40 min, eigen tempo',
    source_date: '2026-04-01',
  },
  {
    key: 'vacation_april_2026',
    category: 'program',
    value: 'Vakantie 13-19 apr 2026: bodyweight circuit om de dag + 2x easy run. Geen opbouw, puur onderhoud. Creatine en whey meenemen',
    source_date: '2026-03-17',
  },
  {
    key: 'pullup_progression_status',
    category: 'program',
    value: 'Pull-up doel in progress. Nog geen echte pull-up. Elke 2 weken testen met negatieve pull-ups (doel: >8s negatief)',
    source_date: '2026-04-02',
  },
  {
    key: 'goblet_to_barbell_threshold',
    category: 'program',
    value: 'Goblet squat → barbell squat evalueren zodra Stef 4x10 op 20 kg haalt. Dan complexiteitssprong overwegen',
    source_date: '2026-03-30',
  },

  // ─── LIFESTYLE ──────────────────────────────────────────────────────────
  {
    key: 'work_schedule',
    category: 'lifestyle',
    value: 'Hybride werkschema: kantoor di/wo/do, thuis ma/vr. Fietst ~14km retour op kantoordagen (niet-elektrisch) = lichte cardio 3x/week',
    source_date: '2026-02-23',
  },
  {
    key: 'gym_timing_preference',
    category: 'lifestyle',
    value: 'Traint 06:30 ochtend bij Train More, Piet Heinkade. Na werk lukt niet. Ochtendtraining beschermen is cruciaal voor consistentie',
    source_date: '2026-02-23',
  },
  {
    key: 'sleep_pattern',
    category: 'lifestyle',
    value: 'Bed ~22:30, op ~07:00. Gymdagen (di/do) opstaan ~06:00 = kortere nacht. Moeite met inslapen. Relevant voor intensiteitskeuzes',
    source_date: '2026-02-23',
  },
  {
    key: 'work_energy_context',
    category: 'lifestyle',
    value: 'Zit in een dip op werk (mede reden voor trainingsprogramma). Mentale energie, focus en scherpte zijn subdoelen naast fysieke doelen',
    source_date: '2026-02-23',
  },

  // ─── INJURY ─────────────────────────────────────────────────────────────
  {
    key: 'shoulder_right_diagnosis',
    category: 'injury',
    value: 'Rechter schouder: verdenking intra-articulaire labrumpathologie. O\'Brien mildpositief, apprehension licht positief. ER beperkt ~60°',
    source_date: '2026-03-26',
  },
  {
    key: 'shoulder_no_overhead',
    category: 'injury',
    value: 'ABSOLUUT verbod: geen overhead pressing. Geen OHP, geen DB shoulder press, geen push press. Altijd handhaven',
    source_date: '2026-03-26',
  },
  {
    key: 'shoulder_cable_row_swap',
    category: 'injury',
    value: 'Single arm cable row provoceert rechter schouder → vervangen door chest-supported DB row (per 26 mrt 2026)',
    source_date: '2026-03-26',
  },
  {
    key: 'shoulder_mri_pending',
    category: 'injury',
    value: 'MRI-arthrogram rechter schouder aangevraagd via huisarts. Staat al weken open. Hoge prioriteit — checken bij elke check-in',
    source_date: '2026-03-26',
  },
  {
    key: 'knees_ocd_history',
    category: 'injury',
    value: 'OCD beide knieën + kraakbeentransplantatie (2016). Squats tot parallel (geen ass-to-grass). Leg press beperkt bereik. Soms pijn bij traplopen',
    source_date: '2026-02-23',
  },
  {
    key: 'bss_interval_rule',
    category: 'injury',
    value: 'Bulgarian Split Squat NIET de dag na intervaltraining — minimaal 1 dag ertussen. Gestapelde kniestress. Bewezen probleem.',
    source_date: '2026-03-09',
  },
  {
    key: 'lower_back_hip_flexors',
    category: 'injury',
    value: 'Onderrug links: verkorte hipflexoren door kantoorzitten → anterieure bekkenkantel. Hipflexor stretch elke 45-60 min op kantoor',
    source_date: '2026-03-23',
  },

  // ─── PREFERENCE ─────────────────────────────────────────────────────────
  {
    key: 'run_eating_timing',
    category: 'preference',
    value: 'Eten MINIMAAL 2 uur voor een run (oats = maagklachten als te kort). Pre-run snack: banaan werkt beter op korte termijn',
    source_date: '2026-02-24',
  },
  {
    key: 'electrolytes_timing',
    category: 'preference',
    value: 'Electrolytes NA runs en padel, NIET na gym. Direct na sessie innemen',
    source_date: '2026-02-24',
  },
  {
    key: 'creatine_daily_rule',
    category: 'preference',
    value: 'Creatine 5g dagelijks, ook op rustdagen. InBody spiermassa-toename bij nieuwe creatinegebruiker = deels waterretentie, geen echte spier',
    source_date: '2026-02-24',
  },
  {
    key: 'exercise_continuity_principle',
    category: 'preference',
    value: 'Zelfde lifts herhalen voor progressive overload. Rotatie alleen bij 2+ sessies stagnatie of logische complexiteitssprong (bijv. goblet → barbell)',
    source_date: '2026-03-17',
  },
  {
    key: 'breakfast_whey_critical',
    category: 'preference',
    value: 'Whey bij ontbijt = hoogste-impact eiwit-habit. Als weggevallen: -19g eiwit/dag. Upfront Eiwit Oats + 1 scoop whey = basisontbijt',
    source_date: '2026-03-24',
  },
  {
    key: 'satiety_formula',
    category: 'preference',
    value: 'Satiety: volume + eiwit + vezels. Eiwitarme snacks (maïswafels, etc.) houden niet vol — terugkerend adherence-risico. Kwark/skyr > maïswafels',
    source_date: '2026-03-23',
  },
  {
    key: 'training_any_is_better',
    category: 'preference',
    value: '30 minuten slechte training > thuisblijven. Bij twijfel altijd doorduwen. Schema aanpassen > skippen',
    source_date: '2026-02-23',
  },
  {
    key: 'nutrition_weekend_agreement',
    category: 'preference',
    value: 'Weekend: max 2 drinkavonden, max 3 bier/keer (was 5+ bier = ~2000 kcal lege calorieën/week). Eiwit 140g blijft ook weekend',
    source_date: '2026-03-24',
  },

  // ─── PATTERN ────────────────────────────────────────────────────────────
  {
    key: 'padel_monday_fixed',
    category: 'pattern',
    value: 'Maandagavond padel is structureel (vast). Intensiteit hoog: HR 155-160, pieken 190, ~900 kcal/sessie. Niet plannen voor zware Lower dag',
    source_date: '2026-02-23',
  },
  {
    key: 'weekend_weak_spot',
    category: 'pattern',
    value: 'Weekenden = zwak punt: alcohol en minder eetstructuur. Specifieke afspraken nodig (max 3 bier, eiwit bijhouden)',
    source_date: '2026-03-24',
  },
  {
    key: 'motivation_pattern',
    category: 'pattern',
    value: 'Houdt het inmiddels lang vol en heeft er plezier in. Geen "gaat afhaken"-aanname. Wel: ochtendtraining beschermen, flexibel zijn als planning wisselt, 30 min > thuisblijven',
    source_date: '2026-05-01',
  },
  {
    key: 'back_to_back_gym_works',
    category: 'pattern',
    value: 'Twee gym-dagen achter elkaar werkt prima (bewezen week 2 ma+di, geen herstelprobleem). Niet ideaal maar haalbaar',
    source_date: '2026-03-09',
  },

  // ─── GOAL ───────────────────────────────────────────────────────────────
  {
    key: 'primary_goal_body_composition',
    category: 'goal',
    value: 'Lichaamscompositie: van 19.4% vet (InBody 23 mrt) naar 16-17%. Deficit ~400-500 kcal/dag. Realistisch in 10-14 weken vanaf mrt 2026',
    source_date: '2026-03-23',
  },
  {
    key: 'inbody_scan_schedule',
    category: 'goal',
    value: 'InBody scan elke 3-4 weken bij Train More. Scan 3 gepland eind april (25-27 apr 2026). Vetmassa is het schonere signaal (niet gewicht)',
    source_date: '2026-03-23',
  },
  {
    key: 'milestone_pushups',
    category: 'goal',
    value: 'Push-ups: baseline 8 → week 4: 20 (✅ doel gehaald). Doel week 8: 25+ of elevated feet',
    source_date: '2026-03-26',
  },
  {
    key: 'milestone_bench_press',
    category: 'goal',
    value: 'DB Bench Press: baseline 10kg → week 4: 16kg. Doel week 8: 18-20kg x 10',
    source_date: '2026-03-26',
  },
  {
    key: 'milestone_goblet_squat',
    category: 'goal',
    value: 'Goblet Squat: baseline 10kg → week 4: 16kg. Doel: 20kg x 10, dan evalueren barbell squat',
    source_date: '2026-03-26',
  },
  {
    key: 'milestone_lat_pulldown',
    category: 'goal',
    value: 'Lat Pulldown: baseline 25kg → week 4: 40kg. Doel week 8: 45kg x 10',
    source_date: '2026-03-26',
  },
  {
    key: 'milestone_plank',
    category: 'goal',
    value: 'Plank (set 1): baseline 1:00 → week 4: 1:35 (✅ doel gehaald). Doel week 8: 2:00+',
    source_date: '2026-03-26',
  },
  {
    key: 'race_future_plan',
    category: 'goal',
    value: 'Race sept/okt 2026 verkennen zodra lichaam sterker is. Nog geen specifieke race gepland. Hardlopen nu in onderhoudsmodus',
    source_date: '2026-04-01',
  },
]

// ---------------------------------------------------------------------------
// Seed function — idempotent, only inserts if memory is empty or force=true
// ---------------------------------------------------------------------------

export async function seedFoundationalMemory(
  userId: string,
  force = false,
): Promise<{ seeded: number; skipped: boolean }> {
  const admin = createAdminClient()

  if (!force) {
    const { count } = await admin
      .from('coaching_memory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (count && count > 0) {
      return { seeded: 0, skipped: true }
    }
  }

  let seeded = 0
  for (const entry of BASELINE_MEMORY) {
    const { error } = await admin.from('coaching_memory').upsert(
      {
        user_id: userId,
        key: entry.key,
        category: entry.category,
        value: entry.value,
        source_date: entry.source_date,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    )
    if (!error) seeded++
  }

  return { seeded, skipped: false }
}
