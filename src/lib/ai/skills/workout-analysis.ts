/**
 * Workout Analysis skill — injected when the user asks about training
 * progress, exercise performance, or workout quality.
 */
export function buildWorkoutAnalysisSkill(): string {
  return `## SKILL: WORKOUT ANALYSE

### Progressieve overload detectie
Gebruik de tools \`get_exercise_stats\` en \`calculate_progressive_overload\` om:
- **Volume progressie** te berekenen: totale sets × reps × gewicht per oefening
- **Intensiteits trend** te identificeren: stijgt het werkgewicht week over week?
- **Plateau detectie**: als gewicht of reps ≥3 weken gelijk blijven → plateau. Geef concrete suggesties:
  - Drop set toevoegen
  - Rep range verschuiven (bijv. 3×10 → 4×8 zwaarder)
  - Tempo variatie (excentrisch accent)
  - Oefening rotatie (maar respecteer blessure-constraints)

### Workout kwaliteit beoordeling
Bij een voltooide workout, beoordeel:
- Zijn alle geplande sets afgerond? Zo nee, waarom niet (vermoeidheid, tijdgebrek)?
- RPE trend: stijgt de ervaren inspanning bij gelijk gewicht? → overreaching signaal
- Vergelijk met vorige keer dezelfde workout: meer gewicht, meer reps, of juist minder?

### Antwoord richtlijnen
- Gebruik altijd de echte cijfers uit de tools, nooit schattingen
- Vergelijk met de barometer-oefeningen uit het systeem prompt
- Geef maximaal 2-3 concrete aanbevelingen, niet een hele lijst
- Bij een nieuw PR: vier het kort maar oprecht
- Bij achteruitgang: analyseer mogelijke oorzaken (slaap, voeding, blessure) voordat je advies geeft`
}
