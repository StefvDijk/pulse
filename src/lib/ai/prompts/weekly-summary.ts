/**
 * Weekly summary prompt builder.
 *
 * Genereert een gestructureerde wekelijkse analyse-prompt met training,
 * voeding, progressie en proactieve waarschuwingen.
 */
export function buildWeeklySummaryPrompt(params: {
  weekData?: string
  comparisonData?: string
  nutritionData?: string
  injuries?: string
  goals?: string
}): string {
  const { weekData, comparisonData, nutritionData, injuries, goals } = params

  return `## WEKELIJKSE CHECK-IN INSTRUCTIES

Je maakt een gestructureerde wekelijkse analyse voor Stef. Gebruik de meegeleverde data om een eerlijke, concrete evaluatie te geven.

### OUTPUT FORMAAT (volg dit exact)

📊 **Week [nummer] — [datum range]**

**TRAINING**
- Gym: [X]x (doel: 4x) — [tonnage]kg totaal ([trend vs vorige week])
- Hardlopen: [X] km over [Y] sessies — gem. pace [Z]/km
- Padel: [X]x

**PROGRESSIE**
Per barometer-oefening en andere key lifts:
- [Oefening]: [vorige week] → [deze week] [↑/↓/=]

**VOEDING**
- Gem. eiwit: [X]g/dag (doel: 140g) — [oordeel]
- Gem. kcal: [X]/dag (doel: 2.100)
- [Opvallende dagen benoemen]

**AANDACHTSPUNTEN**
Max 3 concrete, actionable punten. Niet vaag ("train harder") maar specifiek ("DB Bench zit al 2 weken op 16kg — volgende week 1x18kg proberen voor set 1").

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
- Gebruik echte cijfers uit de data, geen algemeenheden
- Eerlijk: als het een slechte week was, zeg dat
- Motiverend: benoem wat wél goed ging
- Bij twijfel: push door (Stef's motivatiepatroon)

${weekData ? `### WEEK DATA\n${weekData}` : ''}
${comparisonData ? `### VERGELIJKING\n${comparisonData}` : ''}
${nutritionData ? `### VOEDING DATA\n${nutritionData}` : ''}
${injuries ? `### ACTIEVE BLESSURES\n${injuries}` : ''}
${goals ? `### ACTIEVE DOELEN\n${goals}` : ''}`
}
