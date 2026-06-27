# AI Architecture — Pulse

Volledig overzicht van alle AI/LLM-integraties in de Pulse app. Bedoeld voor ontwikkelaars die de codebase willen begrijpen.

---

## Modellen & infrastructuur

Twee modellen, gedeclareerd in `src/lib/ai/client.ts:11-12`:

- **Sonnet 4.6** — alles wat de gebruiker ziet (chat, block-review, check-in analyse/dialog/plan)
- **Haiku 4.5** — alle achtergrondtaken (memory-extractie, suggestions, readiness, nutrition, explain bubbles, sync-analyse)

Alle AI-calls gaan via `src/lib/ai/client.ts` (`streamChat` of `createJsonCompletion`), die automatisch loggen naar de `ai_usage_log` tabel. Pricing zit in `src/lib/ai/pricing.ts`.

**Prompt caching:** De statische helft van het chat-systeemprompt krijgt een `cacheControl: ephemeral` breakpoint → Anthropic houdt dit 5 minuten gecached. Dit scheelt op de grote `buildCoachPersona()` + `buildKnowledgeBase()` blocks.

**Token accounting:** `inputTokenDetails.noCacheTokens` wordt gelogd als inputkosten (niet de ruwe `inputTokens`, want die bevat cache-tokens die anders dubbel geteld worden). Zie `extractUsageForLog()` in `client.ts:85-110`.

---

## 1. Hoofdchat — `POST /api/chat`

**Bestand:** `src/app/api/chat/route.ts`
**Model:** Sonnet 4.6 (Haiku voor `simple_greeting`)
**Streaming:** ja — SSE
**maxSteps:** 8 (agentic tool-loop)
**Rate limit:** 20 req/min

### Systeemprompt

Gesplitst in twee blokken:

**Statisch (gecached):**
- `buildCoachPersona()` — Nederlandse coachingidentiteit, gedragsregels, beperkingen (geen diagnoses, geen meds, geen <1800 kcal)
- `buildKnowledgeBase()` — evidencebased trainingswetenschap: periodisering, Israetel volume landmarks, rep ranges, ACWR, Helms-hiërarchie voor nutrition
- Gebruikersprofiel uit `user_profiles` tabel
- Custom instructions uit `user_settings.ai_custom_instructions`
- Volledige write-back XML-contracten (zie hieronder)

**Dynamisch (per-turn, ongecached):**
- Huidige datum/tijd (Amsterdam-tijdzone)
- Actief trainingsschema
- Actieve blessures + doelen
- `assembleThinContext()`: top 30 coaching_memory rows, top 8 coach_beliefs, laatste 10 PRs, laatste 3 check-ins
- Geselecteerde skill-prompts via `selectSkills()` op basis van berichttype en keywords

### Beschikbare tools

Aangemaakt per-user via `createToolsForUser(userId)` in `src/lib/ai/tools/definitions.ts`:

| Tool | Wat het doet |
|------|-------------|
| `get_workout_history` | Hevy workouts per periode |
| `get_exercise_stats` | PRs, trends, gem. gewicht per oefening |
| `compare_periods` | Twee periodes vergelijken op volume/frequentie/km |
| `get_running_history` | Runs uit Apple Health |
| `get_health_metrics` | Sleep/steps/HRV/RHR/weight/active_energy |
| `get_nutrition_log` | Dagelijkse macro-totalen + maaltijden |
| `get_macro_targets` | Geconfigureerde macro-targets |
| `calculate_progressive_overload` | Volume-progressie + volgende-sessie-aanbeveling |
| `get_recovery_score` | Composiet 1-10 score uit sleep/HRV/RHR/load |
| `search_exercises` | Oefeningen zoeken op naam of spiergroep |
| `get_body_composition` | InBody/Apple Health lichaamscompositie trend |
| `get_active_schema` | Volledig actief trainingsschema |
| `get_injury_history` | Blessurelogboek |
| `get_weekly_aggregations` | Weekaggregaties (tot 52 weken) |
| `ask_stef` | Zet vraag in coach inbox (`coach_questions` tabel) |

### Write-backs

Claude schrijft XML-tags in zijn antwoord die worden geparsed ná de stream en nooit aan de gebruiker getoond (gestript via `createStreamTagStripper` in `src/lib/ai/chat/writebacks.ts`):

| Tag | Actie |
|-----|-------|
| `<nutrition_log>` | `analyzeNutrition()` → insert in `nutrition_logs` |
| `<injury_log>` | Insert in `injury_logs` |
| `<schema_generation>` | Valideert + inserteert trainingsschema, deactiveert oude |
| `<schema_update>` | Partiële schema-aanpassing |
| `<cited_memories>` | Bumpt `last_confirmed_at` + confidence=1.0 op matching coaching_memory rows |

### Fire-and-forget na elke turn

- **Memory extractor** (Haiku) — zie §3
- **Belief extractor** (Haiku) — zie §4

**Storage:** Berichten worden opgeslagen in `chat_messages` met `tokens_used`, `message_type`, `session_id`. Sessies in `chat_sessions`.

---

## 2. Block Review — `POST /api/block-review/analyse`

**Bestand:** `src/app/api/block-review/analyse/route.ts`
**Model:** Sonnet 4.6
**Streaming:** ja — plain text stream
**Rate limit:** 5 req/min
**maxOutputTokens:** 8192

Systeemprompt bevat dezelfde `buildCoachPersona()` + `buildKnowledgeBase()` als chat, plus:
- Blessurebeperkingen (hardcoded regels: geen OHP, squats to parallel only, etc.)
- Schema-eisen (≤55 min/sessie, 4 sessies/week, 30% rotatie, deload elke 3-4 weken)
- Dialoogprotocol: stel vragen óf lever schema, gemarkeerd met `[NU VRAGEN]`

**Context (user message):** Een grote structured block gebouwd door `buildJourneyBlock()`:
- Lifetime stats + prior schemas met adherence %
- Lichaamscompositie baseline → nu
- Key lift progressies (e1RM start → nu)
- Coaching memory + coach beliefs
- Weekly lessons (laatste 8)
- Huidige block stats: adherence, muscle volume per week, sport load trend, exercise progressies top 20
- Stef's reflectie-formulier (ratings per workouttemplate, keep/drop, grootste win/miss)

**Response parsing:** Zoekt naar `<block_proposal>{...}</block_proposal>` in de stream → `validateProgramProposalForUser` (ACWR-check, audit, blockers) → appended `<program_audit>` aan de stream voor de client.

Multi-turn: gesprekhistorie wordt meegegeven. Bij `force_proposal` of `repair_audit` forceert de route schema-output mode.

---

## 3. Memory Extractor — `src/lib/ai/memory-extractor.ts`

**Aangeroepen vanuit:** `/api/chat` (fire-and-forget na elke non-greeting turn)
**Model:** Haiku 4.5 — `generateText`
**maxOutputTokens:** 512

Analyseert één conversatie-turn en extraheert feiten voor `coaching_memory`. Outputt JSON-array van upsert/delete-operaties. Categorieën: `program`, `lifestyle`, `injury`, `preference`, `pattern`, `goal`. Max 5 updates per call.

Input: `GEBRUIKER: {userMessage}\n\nCOACH: {assistantResponse.slice(0,2000)}` + bestaande memories voor deduplicatie.

**Storage:** Upsert naar `coaching_memory` op `key + user_id`.

---

## 4. Belief Extractor — `src/lib/ai/belief-extractor.ts`

**Aangeroepen vanuit:** `/api/chat` (fire-and-forget)
**Model:** Haiku 4.5 — `generateText`
**maxOutputTokens:** 512

Zoekt naar bewijs voor/tegen falsifieerbare hypothesen ("X leidt tot Y") over hoe het lichaam van de gebruiker reageert. Max 2 per call.

**Storage:** Inserteert in `coach_beliefs` of update `evidence_for`/`evidence_against` JSONB-arrays. Herberekent Bayesiaanse confidence-score via `recomputeBelief()`.

---

## 5. Sync Analyst — `src/lib/ai/sync-analyst.ts`

**Aangeroepen vanuit:** `/api/ingest/hevy/sync`, `/api/ingest/apple-health`, `/api/cron/hevy-sync`
**Model:** Haiku 4.5
**maxOutputTokens:** 512

Na elke datasync: analyseert WoW volume trends, PRs, ACWR-wijzigingen. Upsert max 5 coaching_memory rows.

---

## 6. Sport Insight Extractor — `src/lib/ai/sport-insight-extractor.ts`

**Aangeroepen vanuit:** `/api/belasting/sport-insight`, `/api/cron/weekly-aggregate`
**Model:** Haiku 4.5, temperature 0.3

Vindt één patroon in 28 dagen sport-combinatiedata dat het meest herstelvermogen belast. Output: `{"hasInsight": true, "text": "..."}` of `{"hasInsight": false}`. Vereist ≥8 actieve dagen.

**Storage:** Upsert als stabiele key `sport_pattern_hardest_combo` in `coaching_memory`. Verwijdert de key als er geen insight is.

---

## 7. Weekly Lessons Extractor — `src/lib/ai/lessons-extractor.ts`

**Aangeroepen vanuit:** `/api/weekly-lessons/extract`, `/api/cron/weekly-aggregate`
**Model:** Haiku 4.5, temperature 0.4

Extraheert 1-2 korte persoonlijke lessen uit weekdata (max 25 woorden, Nederlands, data-onderbouwd, geen platitudes). Idempotent: delete + insert per user+week in `weekly_lessons`.

---

## 8. Chat Suggestions — `GET /api/chat/suggestions`

**Bestand:** `src/app/api/chat/suggestions/route.ts`
**Model:** Haiku 4.5, temperature 0.5

Genereert precies 3 korte Nederlandse suggesties (max 8 woorden, eerste persoon) op basis van actieve doelen, blessures, coaching memory. Valt terug op dag-specifieke hardcoded suggesties bij AI-fout of ontbrekende context.

**Gerenderd in:** `ChatInterface.tsx` als suggestion chips onder het inputveld.

---

## 9. Readiness Summary — `GET /api/readiness/summary`

**Bestand:** `src/app/api/readiness/summary/route.ts`
**Model:** Haiku 4.5
**maxOutputTokens:** 80
**Cache:** 4 uur in-memory (invalideert om middernacht Amsterdam)

Genereert één Nederlandse zin (max 25 woorden) met huidige readiness + minimaal één concreet getal. Input: level, score 0-100, ACWR, slaap, HRV, RHR, sessies laatste 3 dagen, geplande workout naam. Score berekend via z-scores t.o.v. 30d baselines + ACWR uit persistente EWMA-keten.

**Gerenderd in:** `ReadinessSignal.tsx` en `ReadinessCard.tsx`.

---

## 10. Nutrition Analysis — `src/lib/nutrition/analyze.ts`

**Aangeroepen vanuit:** `POST /api/nutrition/analyze` + chat write-back `<nutrition_log>`
**Model:** Haiku 4.5

Parseert een Nederlandse/Engelse maaltijdbeschrijving (free-text) naar gestructureerde macro-schattingen. Output: calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, food_items. Gevalideerd via Zod-schema (`NutritionAnalysisSchema`) vóór DB-insert.

**Storage:** Insert in `nutrition_logs`, triggert `recomputeDailyNutritionSummary()`.

---

## 11–14. Check-In flows

Alle vier op Sonnet 4.6, geen streaming:

| Endpoint | Bestand | Doel | maxOutputTokens |
|----------|---------|------|-----------------|
| `POST /api/check-in/analyze` | `route.ts` | Weekanalyse: summary, keyInsights, focusNextWeek | 1024 |
| `POST /api/check-in/dialog` | `route.ts` | 1-3 gerichte follow-up vragen op zwakke punten | 512 |
| `POST /api/check-in/plan` | `route.ts` | Weekplan uit schema + Google Calendar-conflicten | 2048 |
| `POST /api/check-in/plan/refine` | `refine/route.ts` | Multi-turn verfijning van weekplan | 2048 |

**Check-in context:** `CheckInReviewData` — weeknummer, sessies, workouts met oefendetails, runs, padel, nutrition-samenvattingen, slaapdata, highlights, aggregatiestatistieken + reflectietekst + dialog Q&A + coaching memory (top 20-30 rows).

Plan en refine berekenen ACWR-projectie na elke AI-call.

---

## 15. Explain Bubbles — `POST /api/explain/[topic]/ai`

**Bestand:** `src/app/api/explain/[topic]/ai/route.ts`
**Model:** Haiku 4.5
**Streaming:** ja — `result.toTextStreamResponse()`
**maxOutputTokens:** 350

Per topic (ACWR, HRV, slaap, etc.) bouwt een registry-module (`src/lib/explain/`) een datasnap + tekstprompt. AI genereert 60-100 woorden feitelijke interpretatie met één concrete actie/observatie. Geen complimenten, geen platitudes, geen emoji. Mag alleen getallen uit de INPUTS citeren.

**Gerenderd in:** Tooltip/explainer bubbles op dashboard-metrics.

---

## 16. Today Subtitle — `GET /api/today`

**Bestand:** `src/app/api/today/route.ts`
**Model:** Haiku 4.5
**maxOutputTokens:** 60
**Cache:** in-memory per user per dag

Eén korte Nederlandse coachingszin (max 12 woorden) voor het "Today Move" kaartje op de homescreen. Input: dagtype (training/rest/check_in) + workout titel.

---

## 17. AI Health Check — `GET /api/health/ai`

**Bestand:** `src/app/api/health/ai/route.ts`
**Model:** Haiku 4.5, maxOutputTokens 5

Puur connectivity check: stuurt "Reply with just: ok", meet latency, retourneert model + response_preview. Auth-required.

---

## Architectuuroverzicht

```
Gebruiker
    │
    ├── Chat (Sonnet 4.6, streaming SSE)
    │       ├── 15 tools → DB reads
    │       ├── Write-backs (XML tags, gestript uit stream) → DB writes
    │       ├── Memory extractor (Haiku, async fire-and-forget)
    │       └── Belief extractor (Haiku, async fire-and-forget)
    │
    ├── Block Review (Sonnet 4.6, streaming plain text)
    │       └── block_proposal parser → validateProgramProposalForUser
    │
    ├── Check-In (Sonnet 4.6, 4 routes, geen streaming)
    │       ├── analyze → summary + keyInsights
    │       ├── dialog → follow-up vragen
    │       ├── plan → weekplan + ACWR projectie
    │       └── plan/refine → multi-turn verfijning
    │
    └── Achtergrond (Haiku 4.5, alle non-blocking)
            ├── Readiness summary (gecached 4h)
            ├── Chat suggestions
            ├── Today subtitle (gecached per dag)
            ├── Nutrition analysis
            ├── Explain bubbles (streaming)
            ├── Sync analyst (na elke data-ingest)
            ├── Weekly lessons (cron + on-demand)
            └── Sport insight (cron + on-demand)
```

## Cross-cutting concerns

**Usage logging:** Elke call logt naar `ai_usage_log` (feature, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, duration_ms, status, error_code). Zie `extractUsageForLog()` in `src/lib/ai/client.ts:85-110`.

**Rate limiting:** In-memory rate limiter (`src/lib/rate-limit.ts`). Chat: 20/min, block-review: 5/min, nutrition: 30/min, check-in routes: 30/min.

**Error handling:** Chat heeft `classifyStreamError()` die Anthropic API-errors mapt naar Nederlandse gebruikersboodschappen. Block-review heeft `formatEmptyStreamFallback()` die ook credit-balance-detectie doet via response body tekst.

**Kostenschatting:** `src/lib/ai/pricing.ts` heeft per-model pricing. `estimateCostUsd()` berekent USD uit de 4 disjuncte token-categorieën (input, output, cache-read, cache-write).
