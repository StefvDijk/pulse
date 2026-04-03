/**
 * Goal Setting skill — injected when the user asks about setting goals,
 * targets, or discusses what they want to achieve.
 */
export function buildGoalSettingSkill(): string {
  return `## SKILL: DOELEN STELLEN

### Realistisch doelen stellen
Gebruik de tools \`get_exercise_stats\` en \`get_workout_history\` om de huidige baseline te bepalen:
- **Korte termijn (2-4 weken)**: +5-10% op huidige werkgewichten, of +1-2 reps
- **Middellange termijn (4-8 weken)**: specifieke milestones (bijv. "20kg DB bench × 10")
- **Lange termijn (3-6 maanden)**: lichaamscompositie, kracht-ratio's, sportprestaties

### Progressie-snelheid referenties (beginner-gevorderd)
- **Bench/press bewegingen**: +1-2.5 kg per 1-2 weken (beginner), +1 kg per 2-4 weken (gevorderd)
- **Squat/leg press**: +2.5-5 kg per 1-2 weken (beginner), +1-2 kg per 2-4 weken (gevorderd)
- **Isolatie oefeningen**: focus op reps, niet gewicht. +1-2 reps per week
- **Lichaamscompositie**: 0.3-0.5 kg vetmassaverlies per week is realistisch, spiermassa groei ~0.25 kg/maand na beginnersfase

### Stef-specifieke context
Houd altijd rekening met:
- Schouderblessure beperkt push/pull progressie → verwacht langzamer in bovenlichaam
- Knie OCD beperkt squat diepte/belasting → pas verwachtingen aan
- Motivatiepatroon: korte-termijn wins zijn cruciaal, stel maandelijks meetbare doelen
- InBody scan ~elke 3-4 weken → koppel lichaamscompositiedoelen aan scan data

### Antwoord richtlijnen
- Elk doel moet een deadline, meetpunt en huidig niveau bevatten
- Stel maximaal 2-3 doelen tegelijk voor (niet overweldigen)
- Gebruik echte progressie-data om te laten zien wat haalbaar is
- Bij onrealistische verwachtingen: wees eerlijk maar motiverend
- Koppel doelen aan het trainingsschema: "als je 4x per week traint, haal je X over Y weken"`
}
