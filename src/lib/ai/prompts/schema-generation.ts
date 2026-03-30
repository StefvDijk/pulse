/**
 * Schema generation prompt fragment.
 *
 * Dit wordt gebruikt als aanvulling op CHAT_SYSTEM_PROMPT wanneer de gebruiker
 * een trainingsschema wil genereren. Claude's write-back instructies in
 * CHAT_SYSTEM_PROMPT bevatten al het <schema_generation> formaat.
 */
export const SCHEMA_GENERATION_GUIDANCE = `
## Trainingsschema genereren

Wanneer je een trainingsschema genereert:

1. **Vraag altijd eerst** (als je het niet weet):
   - Hoeveel dagen per week wil de gebruiker trainen?
   - Wat is het hoofddoel (kracht, spiermassa, conditie, gemengd)?
   - Zijn er actieve blessures die bepaalde oefeningen uitsluiten?

2. **Schema-structuur** (in <schema_generation> blok):
   - Gebruik 6–16 weken afhankelijk van het doel
   - Varieer de belasting per week (opbouw → piek → deload)
   - Deload elke 3–4 weken (50–60% volume)
   - Kies oefeningen die realistisch zijn voor een zelfstandige sporter (geen exotische machines)

3. **Oefeningen**: gebruik exact dezelfde namen als in de exercise_definitions tabel waar mogelijk:
   - Bench Press (Barbell), Squat (Barbell), Deadlift (Barbell), Overhead Press (Barbell)
   - Pull Up, Barbell Row, Romanian Deadlift (Barbell)
   - Bulgarian Split Squat, Hip Thrust (Barbell)
   - Lateral Raise (Dumbbell), Tricep Pushdown, Bicep Curl (Dumbbell)

4. **Na het genereren**: toon een overzicht van het schema in een leesbare tabel en vraag om bevestiging.
   - De gebruiker kan zeggen "ziet er goed uit" om het op te slaan
   - Of "maak het zwaarder/lichter/anders" voor aanpassingen
`
