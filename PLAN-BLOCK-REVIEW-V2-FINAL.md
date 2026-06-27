# Block-Review v2 — Definitief Afrondingsplan

> Dit plan bevat ALLES wat overblijft. Na voltooiing is de block-review en schema-creatie pipeline compleet op trainer-grade niveau.

## Wat al af is (niet aanraken)

- `src/lib/training/program-contract.ts` — ProgramProposalV2 Zod contract
- `src/lib/training/program-quality.ts` — Deterministische quality engine (blockers + warnings + info)
- `src/lib/training/program-save.ts` — Validate + insert pipeline met ACWR-projectie
- `src/lib/training/exercise-lookup.ts` — Exercise → muscle/pattern resolver
- `src/lib/training/acwr.ts` — EWMA-based ACWR + projectie
- DB migratie `20260527000001_program_proposal_v2.sql`
- Aggregator upgrade: `weeklyMuscleVolume`, `movementPatternVolume`, `sportBreakdown`, `sportLoadTrend`, `currentACWR`, `projectedNextBlockACWR`, `weeklyWellness`, uitgebreide `ExerciseProgression` (bestSet, last3Sessions, weeklyVolume, plateauScore)
- PerformanceStep UI: sport breakdown, spiergroepvolume bars, push/pull ratio, wellness sparklines
- ReflectionStep: 4 dimensies (volume/intensity/motivation/recovery_cost), time_pressure checkbox, blessure 5-standen, exercise keep/neutral/drop basis
- AnalysisStep: body meting meesturen, audit extractie uit stream
- NextBlockStep: RPE/rest/tempo/notes/sport_type/deload in preview, audit panel met "Laat coach herstellen"
- ConfirmStep: disabled bij blockers, blocker-errors tonen
- `/api/block-review/analyse`: quality engine server-side, `<program_audit>` in stream, repair_audit support
- `/api/block-review/confirm`: V2 validation, 422 bij blockers, slaat audit/verdicts/missed op
- Chat route: quality engine geïntegreerd via `validateProgramProposalForUser`
- `/api/schema` route: retourneert `progression_rules`, `quality_audit`, `planned_weekly_load`
- AI prompt: alle verrijkte data + V2 format instructie

---

## Taak 1 — Exercise verdict reden-picker + pijnscore (UI)

**Wat:** Types `ExerciseVerdict.reason` en `ExerciseVerdict.painScore` bestaan maar de UI toont ze niet. Bij "drop" moet een reden-picker verschijnen, en bij pijn/blessure een pijnscore slider.

**Waar:** `src/components/block-review/steps/ReflectionStep.tsx`

**Specificatie:**
- Bij verdict `drop`: toon 4 chips: `blessure`, `stagnatie`, `verveling`, `techniek`
- Bij reden `blessure`: toon ook slider 0-10 (pijnscore)
- Bij verdict `keep` of `neutral`: geen extra velden
- Update `exerciseVerdicts` array met `reason` en optioneel `painScore`
- Keep/drop-lijsten (`keepExercises`/`dropExercises`) blijven gesynchroniseerd vanuit de verdicts

**Geen wijzigingen nodig in:** types.ts (al compleet), API routes (accepteren al reason/painScore), prompt (stuurt al exerciseVerdicts JSON mee)

---

## Taak 2 — Gemiste sessies UI

**Wat:** `MissedSession` type bestaat, backend slaat het op, maar er is geen UI. De `missedSessions` array is altijd leeg.

**Waar:** `src/components/block-review/steps/ReflectionStep.tsx`

**Specificatie:**
- Toon alleen als `completed < planned` voor een template (data komt uit `data.templateAdherence`)
- Per template met undershoot: toon "X gemist" label
- Tap → expandeer: per gemiste week-slot een reden-chip: `ziek`, `druk`, `blessure`, `motivatie`, `vakantie`, `overig`
- Maximaal het verschil `planned - completed` aan entries per template
- Weeknummers afleiden: als template 8× gepland was en 6× gedaan, zijn er 2 gemiste weken — toon week 1-8 als selecteerbare slots, of simpeler: gewoon het aantal gemiste met een reden, zonder weekspecificatie
- **Keuze: simpel** — toon per template met undershoot: "[focus]: [N] gemist" met één dropdown-reden per template (niet per individuele week). Dit houdt de UI compact en de data nuttig genoeg voor de AI.
- Update `missedSessions` array in form state

**Geen wijzigingen nodig in:** types.ts (al compleet), API routes (slaan `missed_sessions` al op), prompt (stuurt al `missedSessions` JSON mee)

---

## Taak 3 — Eindreden verplaatsen naar einde reflectiestap

**Wat:** "Hoe sluit je dit blok af?" staat nu bovenaan de ReflectionStep, vóór alle inhoudelijke input. Verplaats naar onderaan, na blessures. Eerst nadenken, dan labelen.

**Waar:** `src/components/block-review/steps/ReflectionStep.tsx`

**Specificatie:** Verplaats de `<section>` met "Hoe sluit je dit blok af?" (regels 78-100) naar na de blessure-sectie (na regel ~244). Geen logica-wijzigingen, alleen volgorde.

---

## Taak 4 — Undo na block-review bevestiging

**Wat:** Database-infra is er (`reverted_at`, `reverted` status in constraint). Bouw de API + UI.

### 4A. API route: `POST /api/block-review/revert`

**Waar:** Nieuw bestand `src/app/api/block-review/revert/route.ts`

**Specificatie:**
- Input: `{ review_id: string }`
- Auth check: user owns the review
- Guard: review.status === 'confirmed' EN review.confirmed_at < 24 uur geleden
- Stappen:
  1. Als `next_schema_id` bestaat: deactiveer dat schema, verwijder het (of markeer inactive)
  2. Heractiveer het oude schema (`review.schema_id` → `is_active = true`)
  3. Update review: `status = 'reverted'`, `reverted_at = now()`
- Return: `{ success: true }`

### 4B. UI: banner op schema-pagina

**Waar:** `src/components/schema/SchemaPageContent.tsx` (of equivalent)

**Specificatie:**
- Bij page load: check of er een `block_review` is met `status = 'confirmed'` EN `confirmed_at` < 24 uur
- Zo ja: toon een banner bovenaan: "Net gestart met [schema-title]. Niet wat je bedoelde? [Ongedaan maken]"
- "Ongedaan maken" → POST `/api/block-review/revert` → herlaad pagina
- Na 24 uur: banner verdwijnt automatisch (simpele tijdscheck)

### 4C. Data route

**Waar:** `GET /api/block-review/revertible` (nieuw) of inline in bestaande schema data fetch

**Specificatie:** Return `{ canRevert: boolean, reviewId: string | null, schemaTitle: string | null }` voor de huidige user

---

## Taak 5 — Volledige test coverage

### 5A. Quality engine — alle regels testen

**Waar:** `tests/lib/training/program-quality.test.ts` (uitbreiden)

**Tests toevoegen:**
- `missing_deload` → blocker bij ≥4 weken zonder deload_week
- `deload_out_of_range` → blocker als deload_week > weeks_planned
- `missing_core` → blocker als geen dead bug/Pallof/plank in schema
- `missing_upper_prehab` → blocker als upper-day geen face pulls/band pull-aparts
- `duplicate_day` → blocker bij twee sessies op dezelfde dag
- `acwr_red` → blocker bij projected ACWR >1.5 met voldoende historie
- `acwr_red_low_history` → warning bij projected ACWR >1.5 met beperkte historie
- `acwr_amber` → warning bij 1.3-1.5
- `muscle_volume_out_of_range` → warning als sets buiten MEV-MRV
- `low_rotation` → warning bij <30% rotatie vs vorig blok
- `missing_unilateral` → warning bij geen unilateral lower-body
- `low_frequency` → warning bij <2× per spiergroep per week
- `push_pull_skew` → warning bij push/pull ratio >2:1
- `unknown_exercise_metadata` → warning bij onbekende oefeningen
- `contract_invalid` → blocker bij ongeldige input (null, missing fields, etc.)
- Happy path → valid proposal met alle checks groen

### 5B. ACWR unit tests

**Waar:** Nieuw bestand `tests/lib/training/acwr.test.ts`

**Tests:**
- `projectACWR` met bekende inputs → correcte ratio
- `statusFor` boundary values: 1.3 = green, 1.31 = amber, 1.5 = amber, 1.51 = red
- `ewma` met constante load → converges naar die load
- Edge: lege loads → ratio 0

> Note: `computeACWR` raakt de database. Ofwel mock Supabase, ofwel test alleen de pure functies (projectACWR, statusFor, ewma). Pure functies testen is pragmatischer voor nu.

### 5C. Contract tests uitbreiden

**Waar:** `tests/lib/training/program-contract.test.ts` (uitbreiden)

**Tests toevoegen:**
- Missend `rpe` veld → fail
- Missend `notes` veld → fail
- Ongeldig `sport_type` → fail
- `weeks_planned` = 0 of 17 → fail
- `start_date` verkeerd formaat → fail
- `coach_rationale` met 4 items (te weinig) → fail
- `coach_rationale` met 9 items (te veel) → fail
- Lege `workout_schedule` → fail
- Run-sessie zonder exercises → pass
- Duplicate day in schedule → pass (contract valideert dit niet, quality engine wel)

### 5D. Aggregator tests

**Waar:** Nieuw bestand `tests/lib/block-review/aggregator.test.ts`

> Note: `aggregateBlockData` raakt Supabase. Twee opties:
> 1. **Mock Supabase** — complex, fragile
> 2. **Test pure hulpfuncties** — `weekOf`, `plateauScore`, `focusKind`, `avgNumber`
>
> **Keuze: optie 2.** Extract de pure functies en test die. De integratietest is de Playwright happy path.

**Tests:**
- `weekOf` — correcte weeknummers voor datums aan begin/einde/midden van blok
- `plateauScore` — score 10 bij flat+declining, score 8 bij flat, score 2 bij growing
- `focusKind` — "Upper A" = gym, "Hardlopen" = run, "Padel doubles" = padel, "Rustdag" = rest
- `avgNumber` — gemiddelde, lege array → null

---

## Volgorde & Afhankelijkheden

```
Taak 1 (verdict reden) ─── onafhankelijk
Taak 2 (gemiste sessies) ── onafhankelijk
Taak 3 (eindreden verplaatsen) ── onafhankelijk
Taak 4 (undo) ── onafhankelijk
Taak 5 (tests) ── onafhankelijk, maar doe na 1-3 zodat testdata consistent is
```

Alles is onafhankelijk — kan parallel of in willekeurige volgorde.

**Aanbevolen volgorde:** 3 → 1 → 2 → 5 → 4

Reden: 3 is een simpele cut-paste (1 min), dan 1 en 2 zijn de UI-taken die de reflectiestap completeren, dan tests om alles te verankeren, dan undo als laatst (meest standalone feature).

---

## Wat NIET in dit plan zit (en waarom)

| Item | Reden |
|---|---|
| Mid-block early review trigger | Apart feature, niet block-review v2 |
| HRV/resting HR trend visualisatie | Apple Health import bestaat, maar visualisatie is apart |
| Warm-up / sessieduur tracking | Hevy API levert geen betrouwbare workout duration |
| In-line doel-creatie in stap 5 | Link naar /goals is acceptabel voor v1 |
| Success-moment transitie-scherm | Stef koos: direct naar /schema is goed |
| Schema-pagina deload-week markering | Schema calendar toont al sport-types; deload-week is een nice-to-have |
| RPE-tracking tijdens blok | Vereist Hevy custom field of handmatige input per set — te groot |

---

## Acceptatiecriteria

Het plan is af wanneer:
- [ ] Bij "drop" verdict verschijnt reden-picker + optionele pijnscore
- [ ] Bij gemiste sessies verschijnt reden-selector per template
- [ ] Eindreden staat onderaan de reflectiestap
- [ ] Undo-banner verschijnt op schema-pagina <24u na confirm
- [ ] Undo-API heractivert oud schema + markeert review als reverted
- [ ] Quality engine: alle 16 regels hebben unit tests
- [ ] ACWR pure functies: projectACWR en statusFor getest
- [ ] Contract: alle edge cases (missing fields, boundaries) getest
- [ ] Aggregator: pure hulpfuncties (weekOf, plateauScore, focusKind) getest
- [ ] Build slaagt (`pnpm build` geen errors)
- [ ] Bestaande tests slagen (`pnpm test`)
