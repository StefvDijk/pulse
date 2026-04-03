/**
 * Recovery & Sleep skill — injected when the user asks about recovery,
 * sleep, fatigue, HRV, or whether they should train today.
 */
export function buildRecoverySleepSkill(): string {
  return `## SKILL: HERSTEL & SLAAP ANALYSE

### Recovery score interpretatie
Gebruik de tool \`get_recovery_score\` om een 1-10 score te berekenen op basis van:
- **Slaap** (40% weging): <6u = slecht, 6-7u = matig, 7-8u = goed, 8u+ = uitstekend
- **HRV** (25% weging): vergelijk met 7-dagen gemiddelde. >10% boven gem = goed hersteld, >10% onder = vermoeid
- **Resting HR** (15% weging): lager dan gemiddeld = goed hersteld, hoger = stress/vermoeidheid
- **Training load** (20% weging): ACWR 0.8-1.3 = sweet spot, >1.5 = overbelasting risico

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
