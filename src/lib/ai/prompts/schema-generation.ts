/**
 * Schema generation prompt builder.
 *
 * Genereert een gedetailleerde prompt voor trainingsschema-generatie,
 * inclusief blessure-beperkingen, schema-eisen en het iteratieve proces.
 */
export function buildSchemaPrompt(params: {
  currentSchema?: string
  blockSummaries?: string
  progression?: string
  injuries?: string
  goals?: string
}): string {
  const { currentSchema, blockSummaries, progression, injuries, goals } = params

  return `## SCHEMA GENERATIE INSTRUCTIES

Je genereert een nieuw trainingsschema voor Stef. Volg deze instructies exact.

### BLESSURE-BEPERKINGEN (ALTIJD RESPECTEREN)
- GEEN overhead pressing (OHP, DB shoulder press) — schouder labrumpathologie
- Squats alleen tot parallel, niet diep — knieën (OCD, kraakbeentransplantatie 2016)
- BSS niet na intervaltraining — minstens 1 dag ertussen
- Leg press: beperkt bereik
- RDL's met neutrale rug, initiatie vanuit heupen — onderrug
- Dead bugs, Pallof press, planks altijd in schema houden — core stabiliteit

### SCHEMA EISEN
- Maximaal 55 minuten per sessie
- 4 sessies per week (ma-do), vrijdag hardlopen
- Progressieve overload: baseer startgewichten op recente progressie-data
- Varieer oefeningen t.o.v. vorige schema's
- Deload elke 3-4 weken
- Altijd pull > push volume (schouder compensatie)
- Face pulls of band pull-aparts in elke upper dag

### ITERATIEF PROCES
1. Genereer een compleet schema en toon het als leesbare tabel
2. Wacht op feedback van Stef
3. Pas aan op basis van feedback
4. Pas als Stef "ziet er goed uit" of "akkoord" zegt, genereer de definitieve versie

### OUTPUT FORMAT
Wanneer Stef het schema bevestigt, roep de **propose_schema_generation** tool aan.
Schrijf GEEN XML-blokken — die worden niet meer geparseerd. Alleen de tool-call slaat het schema op.

De tool verwacht: title, schema_type (upper_lower | push_pull_legs | full_body | custom),
weeks_planned, start_date (YYYY-MM-DD), en workout_schedule als array van dagen
({ day, focus, exercises: [{ name, sets, reps, notes }] }).

${currentSchema ? `### HUIDIG SCHEMA\n${currentSchema}` : ''}
${blockSummaries ? `### VORIGE SCHEMA'S\n${blockSummaries}` : ''}
${progression ? `### PROGRESSIE DATA\n${progression}` : ''}
${injuries ? `### ACTIEVE BLESSURES\n${injuries}` : ''}
${goals ? `### ACTIEVE DOELEN\n${goals}` : ''}`
}
