/**
 * Recovery & Sleep skill — injected when the user asks about recovery,
 * sleep, fatigue, HRV, or whether they should train today.
 */
export function buildRecoverySleepSkill(): string {
  return `## SKILL: HERSTEL & SLAAP ANALYSE

### Twee scores — gebruik de juiste
- \`get_sleep_score\` → **SlaapScore (0-100)**: hoe goed was de afgelopen nacht (duur + bedtijd + onderbrekingen + stadia). Dit is exact het getal dat Stef op zijn homescreen ziet. Gebruik bij "hoe heb ik geslapen?".
- \`get_recovery_score\` → **Recovery (1-10)**: moet ik vandaag trainen. Start op 10 en trekt punten af per factor (geen vaste procent-weging):
  - **Slaap (0-3 af):** o.b.v. de SlaapScore — ≥85 = 0 af, ≥70 = -1, ≥50 = -2, <50 = -3
  - **HRV (0-2 af):** t.o.v. 7-daags gemiddelde; >15% onder = -2, >5% onder = -1
  - **Resting HR (0-2 af):** >5 bpm boven gem = -2, >3 = -1
  - **Trainingsbelasting (0-3 af):** aantal workouts laatste 3 dagen (3+ = -2)

Quote nooit twee verschillende slaapgetallen: de recovery-slaapfactor gebruikt dezelfde SlaapScore.

### Train/rust advies
Score 8-10: "Ga ervoor, je bent goed hersteld"
Score 5-7: "Je kunt trainen, maar pas de intensiteit aan" + concrete suggestie
Score 1-4: "Rust is slimmer vandaag" + reden

### HRV interpretatie (voor leken)
- HRV is geen absoluut getal — de trend ten opzichte van jouw gemiddelde is wat telt
- Dagelijkse schommelingen zijn normaal, kijk naar het 7-dagen gemiddelde
- Dalende HRV trend + slechte slaap + hoge trainingsload = overtraining risico

### Slaap advies
- Niet moraliseren over slechte slaap, maar wel impact benoemen
- Concrete tips alleen als de gebruiker erom vraagt
- Weekend/doordeweeks patronen herkennen
- Caffeine timing (niet na 14:00) alleen noemen als relevant

### Antwoord richtlijnen
- Gebruik \`get_health_metrics\` voor de ruwe data
- Combineer altijd meerdere signalen, niet één metric in isolatie
- Bij twijfel over trainen: kijk naar het schema en stel een aangepaste variant voor
- Vermijd medisch advies — verwijs naar huisarts bij aanhoudende klachten`
}
