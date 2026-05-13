/**
 * Weekly summary skill — markdown format guidance for chat-based reviews.
 *
 * [B6 — Sprint 3] Trimmed. Previously this prompt carried a redundant
 * data-injection contract (weekData/comparisonData/nutritionData/etc.)
 * that the call site never filled. Data now comes from tools:
 *  - get_weekly_aggregations
 *  - get_active_schema
 *  - get_injury_history
 *  - get_body_composition
 *
 * The check-in *flow* still has its own JSON-output prompt in
 * `checkin-analyze.ts` because that endpoint persists structured fields.
 * Chat-based weekly review uses THIS one for human-readable output.
 */
export function buildWeeklySummaryPrompt(): string {
  return `## WEKELIJKSE REVIEW — FORMAT

Je maakt een wekelijkse analyse voor Stef. Roep eerst de relevante tools aan
om de data op te halen (get_weekly_aggregations met weeks_back=2 voor week-
vergelijking, get_active_schema, get_injury_history). Daarna lever je
output in dit formaat (gebruik echte cijfers, geen algemeenheden):

📊 **Week [nummer] — [datum range]**

**TRAINING**
- Gym: [X]x (doel: 4x) — [tonnage]kg totaal ([trend vs vorige week])
- Hardlopen: [X] km over [Y] sessies — gem. pace [Z]/km
- Padel: [X]x

**PROGRESSIE**
- [Oefening]: [vorige week] → [deze week] [↑/↓/=] (gebruik get_exercise_stats indien nodig)

**VOEDING**
- Gem. eiwit: [X]g/dag (doel: 140g) — [oordeel]
- Gem. kcal: [X]/dag (doel: 2.100)

**AANDACHTSPUNTEN**
Max 3 concrete, actionable punten. Niet vaag ("train harder") maar specifiek
("DB Bench zit al 2 weken op 16kg — volgende week 1x18kg proberen voor set 1").

**KOMENDE WEEK**
Planning suggestie op basis van huidig schema en trends.

### PROACTIEVE WAARSCHUWINGEN
Check en benoem als relevant:
- Push/pull balans: als push >> pull, waarschuw (schouder risico)
- ACWR > 1.3: trainingsbelasting te snel gestegen, waarschuw
- ACWR < 0.8: te weinig training, motivatiecheck
- Herhaalde blessure-meldingen zelfde locatie: escaleer advies
- Eiwit < 100g/dag gemiddeld: direct benoemen

### TOON
- Echte cijfers, geen algemeenheden
- Eerlijk: was 't een slechte week, zeg dat. Goede week: benoem wat werkte.
- Bij twijfel: push door (zie motivatiepatroon in system prompt).`
}
