# Fase 2 — AI-systeem Deep Dive (Pulse)

> Audit-datum: 13 mei 2026. Scope: `src/lib/ai/**`, `src/app/api/chat`, `src/app/api/check-in`, `src/app/api/nutrition`.
>
> **TL;DR — Stef, dit is waarom je ontevreden bent:** je hebt twee context-pijplijnen naast elkaar (thin + full), een keyword-classifier die de helft van de edge cases mist, een 4500+ token system prompt die elke request opnieuw door de wire gaat zonder Anthropic prompt caching, write-back via XML-blokken die Claude moet *parallel* genereren met tool-calls, geen enkele test op de classifier of tool-routing, en model-routing die de duurste pad als default kiest. De fix is niet "een betere prompt schrijven" — het is structureel: caching, classifier weghalen, write-back via tools, en een eval-harness die voorkomt dat een prompt-tweak regressies maakt.

---

## 1. Architectuur-snapshot

```
POST /api/chat
  │
  ├─ rate-limit (20/min)                             chat/route.ts:120
  ├─ classifyQuestion(message)  ← keyword regex      classifier.ts:62
  ├─ Promise.all([
  │     assembleThinContext(userId),                 context-assembler.ts:913
  │     fetch active schema (admin),                 chat/route.ts:147
  │     fetch active injuries (admin),               chat/route.ts:154
  │     fetch active goals (admin),                  chat/route.ts:160
  │     fetch user_settings (admin),                 chat/route.ts:166
  │  ])
  ├─ buildSystemPrompt({...})  ← ~4500 tokens        chat-system.ts:8
  ├─ selectSkills(type, message)  ← keyword regex    skills/router.ts:37
  ├─ streamChat({ system, messages, tools, ... })    client.ts:43
  │      maxSteps=8, model = sonnet OR haiku
  │
  └─ readable stream
        ├─ collect fullResponse
        ├─ extractWritebacks(fullResponse)  ← regex   chat/route.ts:58
        ├─ insert assistant message
        ├─ analyzeNutrition() if <nutrition_log>
        ├─ insert injury_log if <injury_log>
        ├─ insert/replace training_schemas if <schema_generation>
        ├─ applySchemaUpdate() if <schema_update>
        └─ extractAndUpdateMemory()  ← Haiku, fire-and-forget
```

Daarnaast bestaan parallelle paden:
- `src/app/api/nutrition/analyze` → `analyzeNutrition()` → Claude Sonnet JSON completion (`nutrition-analysis.ts`).
- `src/app/api/check-in/plan` → Claude Sonnet JSON completion (`checkin-plan.ts`).
- `src/app/api/check-in/analyze` → Claude Sonnet JSON completion (`checkin-analyze.ts`).
- `src/lib/ai/sync-analyst.ts` → Haiku batch-memory-extractor na elke sync.
- `src/lib/ai/memory-extractor.ts` → Haiku per chat-turn (fire-and-forget).

**Modellen:** `claude-sonnet-4-6` (default), `claude-haiku-4-5` (background + simple_greeting). Geen Opus, geen prompt-caching, geen structured outputs via SDK tools (alles via XML in vrije tekst).

**Twee context-assemblers.** `assembleContext()` (volledige, ~32k char cap) wordt **nergens meer aangeroepen** behalve via de re-export — alleen `assembleThinContext()` wordt gebruikt. Dat is dood code (988 regels) en bevat oude builders (nutrition_log, injury_report, weekly_review, progress_question, schema_request, general_chat, simple_greeting). **P0-aanwijzing:** of weggooien of consolideren — nu staat het verwarrend te wachten.

---

## 2. System prompts — scorecards en rewrites

### 2.1 `chat-system.ts` — Pulse Coach hoofdprompt (4500+ tokens)

| Criterium | Score | Toelichting |
|---|---|---|
| Rolduidelijkheid | 8 | "Je bent Pulse Coach, Stef's personal trainer..." duidelijk |
| Taakspecificiteit | 6 | Veel context, weinig over wat te DOEN per intent |
| Outputformaat | 4 | Geen structuur, geen lengte-richtlijn, XML write-back als bijzaak |
| Edge cases | 3 | Niets over "data ontbreekt", "tool faalt", "Stef nors antwoordt" |
| Lengte-efficiëntie | 3 | ~4500 tokens, 80% statisch maar **niet gecached** — €€€ |

**Concrete problemen:**

1. **Hardcoded persoonlijke data in prompt** (`chat-system.ts:16-143`). Stef's leeftijd, lengte, blessures, schema-tabel, InBody-scans, barometer-oefeningen, "geleerde lessen" — alles in een statische string. Dit is een single-user app dus pragmatisch maar:
   - Het wordt elke request opnieuw verstuurd (2.500+ input-tokens × elk gesprek).
   - De data is óók in de database (`coaching_memory`, `profiles`, `personal_records`). Dubbele bron van waarheid → guaranteed drift.
   - Sectie 9 (barometer-tabel) en sectie 10 (InBody-scans) hebben harde datums (29 mrt, 23 mrt) die niet automatisch updaten.

2. **Conflicterende instructies.**
   - Sectie 8: "Bij voedingsinput: schat macro's, geef kort oordeel, sla op."
   - Write-back sectie: "voeg een gestructureerd blok VOOR je antwoord in. De app verwijdert dit blok automatisch en slaat de data op."
   - Maar: er bestaat óók een nutrition tool (`get_nutrition_log`). De prompt vertelt het model nergens om bij nieuwe maaltijden de **schrijftool** niet te gebruiken (die bestaat niet) en bij vragen wél de read tool. Resultaat in productie: Claude logged soms maaltijden via XML, soms via tekst, en haalt soms een read tool aan voor dezelfde turn.

3. **Geen lengte-instructie.** "Kort en puntig" staat alleen in check-in-prompt, niet in chat-system. Sonnet 4.6 produceert default 400-800 tokens per chat, terwijl een coach-app idealiter 80-200 tokens per turn doet.

4. **Schema_generation flow.** Sectie 8 zegt "varieer t.o.v. vorige schema's", schema_generation write-back-doc zegt "ALLEEN bij EXPLICIETE bevestiging". Dit zit twee niveaus diep — geen wonder dat het mis kan gaan.

**Rewrite-voorstel** (top-niveau structuur, cache-vriendelijk):

```
// STATIC BLOCK — cache_control: ephemeral (Stef's profile)
[system identity + role + tone + Stef's profile + injury constraints + lifestyle]
  → 1500 tokens, gecached (5 min TTL), 0,30$/MTok hits ipv 3$/MTok

// SEMI-STATIC BLOCK — cache_control: ephemeral (coaching guidelines)
[gedragsregels, write-back format, tool-usage policy, response length policy]
  → 800 tokens, gecached

// DYNAMIC BLOCK — niet gecached (per-request)
[active schema, active injuries, active goals, custom instructions, latest week, recent PRs, coaching memory]
  → 400-1500 tokens afhankelijk van type
```

Concreet: knip `chat-system.ts:11-144` (`staticSections`) los van `dynamicSections` (`chat-system.ts:158-165`) en voer ze als **twee aparte system blocks** in via de Anthropic API met `cache_control: { type: 'ephemeral' }` op het eerste blok. Bij 100 users × 50 chats/dag is dat ~5M input-tokens/dag aan statische content. Sonnet read-cache kost 0,30$/MTok ipv 3$/MTok → ~€220/maand besparing.

> **Caveat: het AI SDK (`@ai-sdk/anthropic` v3.0) ondersteunt `providerOptions.anthropic.cacheControl` op `system` als array.** De huidige `streamText({ system: string, ... })` ondersteunt geen multi-block. Migreer naar `system: [{ type: 'text', text: '...', providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }, ...]`. **Bevestig met Context7 of latest @ai-sdk/anthropic docs voordat je dit implementeert** — de SDK syntax verandert wel eens.

**Lengte-toevoeging:**
```
## RESPONSE FORMAT
- Standaard: 2-6 zinnen, max 100 woorden
- Bij progressie/data-vragen: kort overzicht + 1 concrete suggestie
- Bij voedingslog: bevestig macro's in 1 zin, dan stil
- Bij blessure: 2-3 vragen om uit te diepen, daarna advies
- GEBRUIK ALLEEN bullets bij >3 items
- Tabel alleen bij wekelijkse review
- Stop nooit met "laat me weten" / "vraag gerust" — Stef weet dit
```

### 2.2 `nutrition-analysis.ts` — voedingsanalyse

| Criterium | Score |
|---|---|
| Rolduidelijkheid | 8 |
| Taakspecificiteit | 7 |
| Outputformaat | 8 — JSON schema is duidelijk |
| Edge cases | 5 — confidence is goed gedefinieerd; geen fallback bij "ik heb gegeten" zonder details |
| Lengte-efficiëntie | 9 |

**Probleem:** geen structured-output gebruikt (Anthropic ondersteunt tools mét Zod via AI SDK `generateObject`). Nu: Claude → string → `JSON.parse` → `Zod.parse`. Bij parse-error wordt de error pas zichtbaar in `/api/nutrition/analyze` (route.ts:67) — die teruggeeft `AI_PARSE_ERROR`, maar voor de **write-back vanuit chat** (`chat/route.ts:283`) wordt de error stil weggevangen (`console.error`). Stef ziet niets, het log verschijnt niet, hij denkt dat het werkt.

**Rewrite-suggestie:** switch naar `generateObject({ schema: NutritionAnalysisSchema })` uit `ai` SDK. Dat dwingt JSON-Schema-validatie aan model-zijde en elimineert de regex/parse-laag.

### 2.3 `schema-generation.ts` — trainingsschema-prompt

| Criterium | Score |
|---|---|
| Rolduidelijkheid | 7 |
| Taakspecificiteit | 8 |
| Outputformaat | 4 — "leesbare tabel" + XML write-back, niet eenduidig |
| Edge cases | 3 — wat als gebruiker "doe maar" zegt zonder voorgaand voorstel? |
| Lengte-efficiëntie | 8 |

**Conflicterende instructies:**
- "Genereer een compleet schema en toon het als leesbare tabel" (stap 1)
- "Wacht op feedback" (stap 2)
- Maar de prompt zit in elk chat-request waar SCHEMA_KEYWORDS matchen (`skills/router.ts:43`). Het model kan dus per ongeluk meteen een `<schema_generation>` blok meeschrijven bij de eerste turn.

**Rewrite:** voeg een expliciete state-check toe. "Als deze conversatie al een schema-voorstel bevat en de gebruiker zegt 'ja/doe maar/akkoord', geef dan het schema_generation blok. Anders: toon eerst een voorstel als tabel."

### 2.4 `checkin-plan.ts` — week-planner

| Criterium | Score |
|---|---|
| Rolduidelijkheid | 8 |
| Taakspecificiteit | 9 — 10 expliciete trainingsregels |
| Outputformaat | 9 — JSON schema strict |
| Edge cases | 7 — fallback voor "geen schema" zit in route.ts:176 (padelOnlyPlan), niet in prompt |
| Lengte-efficiëntie | 9 |

**Goed prompt.** Enige opmerking: regel 5 zegt "Hardlopen op een rustdag of in de avond (18:00–19:00)" — geen rationale, en de tijd is niet onderhandelbaar. Stef loopt regelmatig 's ochtends. Maak dit context-afhankelijk.

### 2.5 `checkin-analyze.ts` — wekelijkse review-prompt

| Criterium | Score |
|---|---|
| Rolduidelijkheid | 9 |
| Taakspecificiteit | 8 |
| Outputformaat | 9 |
| Edge cases | 7 — "Als er weinig data is, benoem dat eerlijk" is correct gespecificeerd |
| Lengte-efficiëntie | 9 |

**Geen rewrite nodig.** Solide.

### 2.6 `weekly-summary.ts` — alternatieve wekelijkse review

| Criterium | Score |
|---|---|
| Rolduidelijkheid | 6 |
| Taakspecificiteit | 7 |
| Outputformaat | 4 — markdown met emoji-headers, niet JSON, maar wordt geïnjecteerd in streaming chat |
| Edge cases | 4 |
| Lengte-efficiëntie | 6 |

**Probleem:** wordt aangeroepen via `selectSkills('weekly_review', ...)` (`skills/router.ts:47`) en gemengd in de chat system prompt. Maar `/api/check-in/analyze` heeft een **andere** review-prompt (`checkin-analyze.ts`) die wél JSON output verwacht. **Twee parallelle wekelijkse reviews** met verschillende output-formats. Stef krijgt verschillende antwoorden afhankelijk van of hij in chat "deze week" zegt of de check-in flow doorloopt.

**Rewrite-voorstel:** kies één. Ofwel verwijder `weekly-summary.ts` en route alles via de check-in flow, ofwel maak de chat-variant kort (max 200 woorden, geen markdown headers).

### 2.7 Skill-prompts (`workout-analysis.ts`, `recovery-sleep.ts`, `goal-setting.ts`)

| Prompt | Score | Toelichting |
|---|---|---|
| workout-analysis | 7 | Concrete plateau-detectie regels, instrueert tool-gebruik. Probleem: wordt 2x toegevoegd voor `weekly_review` + keyword match (`skills/router.ts:48+64`) — `skills.some(s => s.includes('WORKOUT ANALYSE'))` guard helpt, maar de logica is fragiel. |
| recovery-sleep | 8 | Goede uitleg HRV interpretatie. Geen issues. |
| goal-setting | 8 | Concrete progressie-snelheden, persoonlijke context. |

**Geen rewrite nodig.** Wel: deze skill-prompts (~300 tokens elk) komen *bovenop* de 4500-token system prompt. Bij `weekly_review` worden weekly-summary + workout-analysis bijgesneden, dat is +1100 tokens. Totaal kan dus 6000+ tokens system prompt zijn per request. **Met caching is dat geen probleem; nu wel.**

### 2.8 Memory-extractor (`memory-extractor.ts:10-33`) en sync-analyst (`sync-analyst.ts:11-38`)

| Prompt | Score | Toelichting |
|---|---|---|
| memory-extractor | 7 | Duidelijke categorieën, "Max 5 updates per beurt". Mist een instructie "geen fact opslaan dat al letterlijk in de bekende herinneringen staat". |
| sync-analyst | 7 | Vergelijkbaar. Beide gebruiken Haiku — goed. |

**Beide:** parsen met `JSON.parse(/\[[\s\S]*\]/.exec(text)?.[0])`. Bij malformed → stille return. Geen retry, geen Zod-validatie naast de category-check. Dat is functioneel acceptabel (fire-and-forget) maar je krijgt geen telemetrie of het werkt.

---

## 3. Context assembler — bottlenecks

### 3.1 Classifier (`classifier.ts`)

**Hoe het werkt:** pure substring matching met `.toLowerCase().includes()`. 8 categorieën, ~60 keywords totaal. Pre-priorities: greeting → injury → schema → nutrition_log vs nutrition_question → progress → weekly_review → general.

**Edge case test (mentaal uitgevoerd op 20 inputs):**

| Input | Verwacht | Werkt classifier? |
|---|---|---|
| "ik heb pijn in mijn schouder na bench" | injury_report | ✓ (pijn) |
| "vandaag 2 eieren en havermout" | nutrition_log | ✓ (eieren, havermout) |
| "hoe gaat mijn bench press?" | progress_question | ✗ — "?" + geen keyword match → general_chat. "bench" zit alleen in PROGRESS_KEYWORDS maar wordt nooit bereikt want check is `hasQuestionMark && hasNutritionQuestion && !hasFoodDescription` → false → valt door naar `hasNutritionLog` (false) → `PROGRESS_KEYWORDS` (✓ "bench"). Eigenlijk werkt het, maar volgorde is broos. |
| "vanmiddag salade" | nutrition_log | ✓ (salade) |
| "hoeveel eiwit zit er in 200g kwark?" | nutrition_question | ✗ — heeft "?", heeft "eiwit", maar óók "kwark" in FOOD_DESCRIPTION_KEYWORDS → klassificeert als nutrition_log. **BUG.** |
| "mijn knie doet zeer als ik squat" | injury_report | ✓ |
| "stef heeft enkel verzwikt" | injury_report | ✓ (enkel) |
| "wat raad je aan voor mijn workout vandaag" | general_chat? progress? | ✗ — "workout" zit niet in keywords, "raad je aan" niet. → general_chat. Discutabel maar wellicht acceptabel. |
| "moet ik vandaag trainen?" | general_chat? recovery? | classifier zegt general_chat, daarna voegt skills/router RECOVERY_KEYWORDS toe. OK. |
| "evalueer mijn week" | weekly_review | ✓ (week, "evaluatie" niet — maar "week" matcht) |
| "hoi" | simple_greeting | ✓ |
| "goedemorgen, kan ik vandaag trainen?" | recovery / general | classifier: lower.length=37 ≥ 30 → niet greeting. Heeft "?", geen andere keywords. → general_chat. OK. |
| "geblesseerd aan rechterknie" | injury_report | ✓ |
| "gisteren 3000 kcal binnen" | nutrition_log of nutrition_question | "gisteren" geen keyword, "kcal" zit in NUTRITION_QUESTION_KEYWORDS, geen "?" → general_chat. **BUG.** |
| "maak nieuw schema" | schema_request | ✓ (nieuw schema) |
| "deze week was zwaar" | weekly_review | ✓ (deze week) |
| "ik ga padel spelen" | general_chat | ✓ |
| "rdl ging beter dan vorige keer" | progress | "rdl" geen keyword in classifier (zit alleen in WORKOUT_ANALYSIS_KEYWORDS van skills/router), "beter" niet. → general_chat. **Miss.** |
| "kun je een pull/push schema maken" | schema_request | "schema" matcht → ✓ |
| "rugklachten weer terug" | injury_report | "rug" matcht → ✓ |

**Concrete failure modes:**
1. **"eiwit" + voedingsmiddelnaam** wordt nutrition_log ipv nutrition_question (`classifier.ts:87-92`). Resultaat: Claude probeert het "te loggen" en de write-back regex match niets → geen action, verwarring.
2. **"kcal", "macro" zonder vraagteken** zonder "eet/at" wordt general_chat. Resultaat: geen nutrition context geladen.
3. **Exercise namen** als "deadlift", "rdl", "pulldown" — niet in PROGRESS_KEYWORDS → progressie-vragen worden general_chat.
4. **Single-language assumption** — Engelse messages ("how was my workout?") matchen niets buiten "bench/squat/deadlift". Stef chat in NL maar als hij ooit Engels typt, breekt het.

**Aanbeveling:** vervang de keyword classifier door **één extra Haiku-call** die de message classificeert + intent + relevante data-types in één gestructureerde output:

```typescript
const classifySchema = z.object({
  type: z.enum([...]),
  needs_recent_workouts: z.boolean(),
  needs_nutrition_today: z.boolean(),
  needs_recovery_metrics: z.boolean(),
  needs_schema: z.boolean(),
})
```

Kosten: 1 extra Haiku call à ~200 input + 50 output tokens = $0.0004 per chat. Bij 5000 chats/maand = $2/maand. Verwaarloosbaar tegenover de fout-recovery die je nu mist.

**Alternatief:** behoud regex maar voeg unit tests toe (zie sectie 5).

### 3.2 Context selectie per type

`assembleThinContext` (`context-assembler.ts:913`) laadt nu **alleen** `coaching_memory` + recent PRs. De type-specifieke builders (`buildNutritionContext`, `buildInjuryContext`, etc., regels 130-857) zijn **niet** meer in gebruik in de chat-flow. Dat is intentioneel ("tools fill the rest") maar:

- Het systeem prompt loadt nog wel `activeSchema`, `activeInjuries`, `activeGoals`, `customInstructions` (`chat/route.ts:147-170`) — **die 4 queries gaan altijd, ongeacht type**. Voor een eenvoudige greeting is dat 4 onnodige DB hits. Bij hoge volumes telt dit.
- Tools dekken niet alles wat de oude builders dekken. Bijvoorbeeld: er is geen tool voor "lichaamscompositie" / `body_composition_logs`, geen tool voor `weekly_aggregations` (alleen `compare_periods`). Dus voor "hoe gaat mijn vetpercentage?" heeft het model geen tool → moet bluffen vanuit het system prompt of zeggen "ik weet het niet".

**Aanbeveling:** voeg tools toe voor body composition (`get_body_composition`), voor injury history (`get_injury_history`), en voor schema (`get_active_schema`). Dan kan het system prompt écht statisch zijn en zijn alle dynamische sectie's tool-gedreven.

### 3.3 Token budget

- `MAX_CONTEXT_CHARS = 32000` (`context-assembler.ts:6`) → bedoelt ~8000 tokens. Truncatie via `slice(0, 32000)` is naïef — kan midden in een line afkappen.
- In de **thin** mode is dit geen probleem (typisch <2k chars). In de **legacy full** mode is het wel een issue voor weekly_review/progress (workouts × exercises × sets blow up).
- Geen logging van actuele token-counts. `result.usage` wordt gelogd naar DB (`chat/route.ts:267`) maar alleen `outputTokens`. **Input tokens (en daarmee cache-hits) worden niet getrackt.**

### 3.4 Prompt caching

**Geconstateerd:** `grep -r "cache_control\|cacheControl\|providerOptions" src/` → **0 hits**. Caching wordt niet gebruikt.

Bij 100 users × 50 chats/dag × 4500 input-token system prompt = 22.5M input-tokens/dag. Op Sonnet $3/MTok = $67,50/dag = **~€2.000/maand**. Met 90% cache-hit (haalbaar als statisch blok niet wijzigt): $0.30/MTok voor cache reads → ~€200/maand. **Besparing: ~€1.800/maand.**

Concreet aan te passen: `client.ts:43-51` en `chat-system.ts:234-246`. Splits system in een gecached statisch blok en een dynamisch tail-blok.

### 3.5 Conversation history

`chat/route.ts:202-211`: laatste 20 berichten van de session. Geen compressie, geen summarization. Bij een lang gesprek (40 turns over 2 dagen) verlies je context na turn 20 — geen waarschuwing aan de gebruiker, geen rolling summary.

**Aanbeveling:** bij >15 turns, run een Haiku summarization van de oudste 10 turns en vervang die door 1 system-note "Eerder besproken: ...". Pas dit toe in `chat/route.ts:209`.

---

## 4. Streaming chat — latency, errors, tracking

### 4.1 Latency

**First-token latency** is afhankelijk van:
1. 5 parallelle DB queries (chat/route.ts:145-170) — sequentieel niet, dus ~50-100ms.
2. Session creatie als nieuw (1 insert, ~50ms).
3. History fetch (1 select, ~30ms).
4. User message insert (~30ms).
5. Anthropic eerste byte (~500-1500ms voor Sonnet).

**Probleem `chat/route.ts:202-219`:** history fetch en user-message-insert zijn **sequentieel** (await na await). De insert van user message kan parallel met de Anthropic call. Nu wacht het ~30ms onnodig.

**Probleem `chat/route.ts:182-199`:** als er geen session_id is, eerst `INSERT chat_sessions` *await*-en. Dan pas history fetch (lege history sowieso). Voeg een fast-path toe: als geen session_id, sla de session-insert in parallel met de streamtext call.

### 4.2 Tools serieel of parallel

`streamChat` zet `stopWhen: stepCountIs(maxSteps)` met maxSteps=8 (`client.ts:43-49`). De AI SDK v6 ondersteunt parallel tool-calls. Anthropic Sonnet kan meerdere tools in één turn aanroepen. **Goed.** Geen issue.

### 4.3 Error handling

`chat/route.ts:378-385`: bij streaming error → encoderd `[ERROR]` event + close. **Acceptabel** maar:
- Geen onderscheid tussen rate limit (429 van Anthropic), context_length_exceeded, malformed tool call, of overload (529).
- Bij `result.usage` failure (regel 266) wordt de hele response van DB save afhankelijk gemaakt — als usage faalt, faalt alles inclusief de schema write-back. **Risico.**

**Fix:** wrap `await result.usage` in try/catch en gebruik 0 als fallback. Code-locatie: `chat/route.ts:266`.

### 4.4 Token tracking

Output tokens worden opgeslagen (`chat/route.ts:273`). **Input tokens, cache reads, cache writes — niet.** Geen kostenrapportage mogelijk per user/per dag. Voeg toe:
```typescript
tokens_input: usage.inputTokens ?? 0,
tokens_cache_read: usage.cacheReadInputTokens ?? 0,
tokens_cache_write: usage.cacheCreationInputTokens ?? 0,
```

Migratie nodig: kolommen toevoegen aan `chat_messages`.

---

## 5. Write-back tools — failure modes

### 5.1 Het structurele probleem: XML write-back **naast** tools

Pulse gebruikt twee parallelle write-mechanismen:
1. **Read tools** via AI SDK (`get_workout_history`, etc.) — server-side, Zod-gevalideerd, retries built-in.
2. **Write tools** via XML in de tekstoutput (`<nutrition_log>`, `<injury_log>`, `<schema_generation>`, `<schema_update>`) — geparsed door regex (`chat/route.ts:58-106`).

**Waarom dit fout is:**
- Geen schema-validatie aan Claude-zijde. Claude kan `{"severity": "extreme"}` produceren; alleen de fallback `?? 'mild'` (`chat/route.ts:302`) redt het.
- Geen retry bij parse error. `try { JSON.parse(...) } catch { /* ignore */ }` — Stef ziet zijn maaltijd niet gelogged, geen waarschuwing.
- Geen idempotentie. Als Claude per ongeluk 2x `<nutrition_log>` produceert (alleen de eerste wordt gematcht — `RegExp.exec` returnt eerste match), wordt het tweede stil genegeerd.
- Tool-routing edge case: Claude kan een tool aanroepen (`get_nutrition_log`) ÉN tegelijk een `<nutrition_log>` XML uitspuwen. Geen contract dat zegt "doe één van beide".

**Failure scenario's per tool:**

| Tool | Failure | Wat gebeurt nu | Wat zou moeten gebeuren |
|---|---|---|---|
| `<nutrition_log>` | malformed JSON | stil weg, geen log | retry of toon error |
| `<nutrition_log>` | Claude API faalt in `analyzeNutrition` | `console.error`, user ziet niets (chat/route.ts:289) | sla toch een ruwe log op met `confidence: 'low'` |
| `<injury_log>` | severity ongeldig | `?? 'mild'` (chat/route.ts:302) — silently wrong | reject + Claude re-prompt |
| `<schema_generation>` | invalid schema_type | mapt naar `'custom'` (chat/route.ts:317) — silently wrong | reject + tell Claude |
| `<schema_generation>` | workout_schedule null | inserted als `[]` (chat/route.ts:329) — leeg schema actief! | reject |
| `<schema_update>` | day not found in schedule | stil return zonder update (chat/route.ts:432) | tell Claude in next turn |

### 5.2 Aanbeveling: write-back als echte AI SDK tools

Refactor naar:
```typescript
log_nutrition: tool({
  description: 'Log een maaltijd die de gebruiker heeft gegeten...',
  inputSchema: z.object({ input: z.string(), meal_type: z.enum([...]).optional() }),
  execute: async (input) => {
    const result = await analyzeNutrition({ userId, ...input })
    return `Gelogged: ${result.data.calories} kcal, ${result.data.protein_g}g eiwit`
  },
}),

log_injury: tool({...}),
generate_schema: tool({...}),
update_schema: tool({...}),
```

Voordelen:
- Zod-validatie aan model-zijde. Claude weet exact welke `severity` waardes mogen.
- Tool resultaat wordt zichtbaar als observatie in conversatiegeschiedenis → Claude kan reageren ("Ik heb het gelogged: 450 kcal").
- Geen XML-parsing meer. -150 regels code.
- Streaming UI kan tool-execution events laten zien aan de gebruiker.

### 5.3 Memory write-back

`extractAndUpdateMemory` (`memory-extractor.ts:55`) — fire-and-forget na elke chat-turn. Issues:
- **Geen rate-limiting.** Bij 50 chats/dag = 50 extra Haiku calls. ~$0.15/maand/user. Acceptabel.
- **Onverwacht delete-gedrag.** Claude kan `action: 'delete'` produceren op een key waarvan geen value bestaat → stille delete op niets. Niet kritiek.
- **Conflict merging.** Twee parallelle turns kunnen beide aan dezelfde `key` upserten. `onConflict: 'user_id,key'` voorkomt duplicates, maar last-write-wins → één van de twee facten verdwijnt.

---

## 6. Coaching memory — selectie, updates, capping

### 6.1 Selectie

`loadCoachingMemory` (`context-assembler.ts:863`): laadt **alle** memory, geen limit, geordend op category + updated_at desc. Output: ge-categoriseerde bulleted lijst.

**Probleem:** als Stef 200 memories accumuleert (realistic na 6 maanden), worden alle 200 elk request meegestuurd. Geen recency-decay, geen relevance-filter op intent. Token-blow-up.

**Aanbeveling:**
- Cap op 30 meest recent updated.
- Voor de top-15 oudste: voeg `created_at` ouder dan 60 dagen + recency-score < threshold → archiveer naar `coaching_memory_archive`.
- Per question type filter: bij `nutrition_log` → alleen category in (`preference`, `pattern`, `lifestyle`). Bij `injury_report` → alleen `injury`.

Code-locatie: `context-assembler.ts:865-871`. Voeg `.limit(30)` toe als quick fix.

### 6.2 Updates

Twee plekken die schrijven: `memory-extractor.ts` (per chat) en `sync-analyst.ts` (per Hevy/HAE sync). Geen merging-logica: beide upserten via key. Als beide tegelijk een key updaten met verschillende values, last-write-wins.

### 6.3 Capping

Geen cap op coaching_memory tabel. Geen TTL. Geen archive.

---

## 7. Eval-harness — bestaat NIET

`grep -r "eval" tests/` → niets relevants. Geen test op classifier, geen test op tool-routing, geen test op write-back parsing, geen test op prompt regressies. **Dit is direct waarom Stef ontevreden is:** elke prompt-tweak is "tweak en bid". Er is geen signaal of een verandering iets verbetert of breekt.

### Voorgestelde blueprint: `scripts/eval-ai.ts`

```typescript
// scripts/eval-ai.ts
import { classifyQuestion } from '@/lib/ai/classifier'
import { selectSkills } from '@/lib/ai/skills/router'

interface TestCase {
  id: string
  input: string
  expected_type: ReturnType<typeof classifyQuestion>
  expected_skills?: string[]           // substring matches in injected skill prompts
  expected_tool_calls?: string[]       // welke tools zou Claude moeten aanroepen
  must_contain?: string[]              // substrings die in het antwoord moeten zitten
  must_not_contain?: string[]
  category: 'classifier' | 'tool_routing' | 'output_quality' | 'safety'
}

const testCases: TestCase[] = [
  // ── Classifier (10) ────────────────────────────────────────────────
  { id: 'C01', input: 'hoi', expected_type: 'simple_greeting', category: 'classifier' },
  { id: 'C02', input: 'pijn in mijn schouder na bench', expected_type: 'injury_report', category: 'classifier' },
  { id: 'C03', input: 'vandaag 2 eieren en havermout', expected_type: 'nutrition_log', category: 'classifier' },
  { id: 'C04', input: 'hoeveel eiwit zit er in 200g kwark?', expected_type: 'nutrition_question', category: 'classifier' },
  { id: 'C05', input: 'maak een nieuw push pull schema', expected_type: 'schema_request', category: 'classifier' },
  { id: 'C06', input: 'hoe ging mijn bench press deze maand', expected_type: 'progress_question', category: 'classifier' },
  { id: 'C07', input: 'evalueer mijn week', expected_type: 'weekly_review', category: 'classifier' },
  { id: 'C08', input: 'gisteren 3000 kcal binnen', expected_type: 'nutrition_log', category: 'classifier' },
  { id: 'C09', input: 'rdl ging zwaarder dan vorige keer', expected_type: 'progress_question', category: 'classifier' },
  { id: 'C10', input: 'moet ik vandaag trainen?', expected_type: 'general_chat', category: 'classifier' },

  // ── Tool routing (10) — heeft een live Claude-call nodig ────────────
  { id: 'T01', input: 'hoe gaat mijn bench press?', expected_type: 'progress_question',
    expected_tool_calls: ['get_exercise_stats'], category: 'tool_routing' },
  { id: 'T02', input: 'kun je vergelijken hoe ik deze maand vs vorige maand presteer?',
    expected_type: 'progress_question', expected_tool_calls: ['compare_periods'], category: 'tool_routing' },
  { id: 'T03', input: 'wat is mijn slaap-gemiddelde deze week?', expected_type: 'general_chat',
    expected_tool_calls: ['get_health_metrics'], category: 'tool_routing' },
  { id: 'T04', input: 'moet ik vandaag squatten? Ik voel me moe',
    expected_tool_calls: ['get_recovery_score'], category: 'tool_routing' },
  { id: 'T05', input: 'wat at ik gisteren?', expected_tool_calls: ['get_nutrition_log'], category: 'tool_routing' },
  { id: 'T06', input: 'ben ik op schema voor mijn 100kg deadlift?',
    expected_tool_calls: ['get_exercise_stats', 'calculate_progressive_overload'], category: 'tool_routing' },
  { id: 'T07', input: 'wat zijn alternatieven voor cable row?',
    expected_tool_calls: ['search_exercises'], category: 'tool_routing' },
  { id: 'T08', input: 'hoeveel km heb ik gerend deze week?',
    expected_tool_calls: ['get_running_history'], category: 'tool_routing' },
  { id: 'T09', input: 'wat is mijn eiwit-target?', expected_tool_calls: ['get_macro_targets'], category: 'tool_routing' },
  { id: 'T10', input: 'heb ik vooruitgang geboekt op pulldown deze 3 maanden?',
    expected_tool_calls: ['get_exercise_stats'], category: 'tool_routing' },

  // ── Output quality / safety (10) ────────────────────────────────────
  { id: 'O01', input: 'maak een schema met OHP elke dag', must_not_contain: ['OHP', 'overhead press'],
    must_contain: ['schouder', 'niet'], category: 'safety' },
  { id: 'O02', input: 'ik wil 200kg deadliften over 4 weken',
    must_contain: ['realistisch', 'niet haalbaar'], category: 'safety' },
  { id: 'O03', input: 'ik heb 1500 kcal gehad vandaag en 5x getraind',
    must_contain: ['deficit', 'genoeg eten'], category: 'output_quality' },
  { id: 'O04', input: 'voorstel kort weekschema voor vakantie zonder gym',
    must_contain: ['bodyweight', 'push-up'], category: 'output_quality' },
  { id: 'O05', input: 'mijn knie doet weer pijn', must_contain: ['BSS', 'squat', 'niet doorduwen'], category: 'safety' },
  { id: 'O06', input: 'zal ik bench springen vandaag?', must_contain: ['recovery', 'slaap'], category: 'output_quality' },
  { id: 'O07', input: 'plan mijn week', must_contain: ['padel', 'maandagavond'], category: 'output_quality' },
  { id: 'O08', input: '3 eieren havermout 50g whey', must_contain: ['eiwit', 'kcal'], category: 'output_quality' },
  { id: 'O09', input: 'wat is creatine?', must_not_contain: ['ik weet het niet'], category: 'output_quality' },
  { id: 'O10', input: 'mag ik straks alcohol?', must_contain: ['weekend'], category: 'output_quality' },
]

async function run() {
  let passed = 0, failed = 0
  for (const tc of testCases) {
    if (tc.category === 'classifier') {
      const actual = classifyQuestion(tc.input)
      if (actual === tc.expected_type) { passed++ }
      else { failed++; console.error(`✗ ${tc.id}: expected ${tc.expected_type}, got ${actual}`) }
      continue
    }
    // Voor tool_routing en output_quality: doe een echte chat-call via een testharness
    // die de stream consumeert, tool-calls verzamelt, en finale tekst evalueert.
    const result = await runChatTest(tc.input)
    // ... assert tools, contains, etc.
  }
  console.log(`${passed}/${testCases.length} passed`)
  process.exit(failed > 0 ? 1 : 0)
}
```

Run als CI-step bij elke PR die `src/lib/ai/**` raakt. **Tijdinvestering:** 1 dag bouwen, 4u/maand onderhoud. **ROI:** voorkomt regressions die nu pas in productie worden gespot.

---

## 8. Modelkeuze en kostenberekening

### 8.1 Huidige modelroutering

| Endpoint | Model | Reden |
|---|---|---|
| `/api/chat` (default) | sonnet-4-6 | hoofdmodel |
| `/api/chat` (simple_greeting) | haiku-4-5 | optimalisatie |
| `/api/nutrition/analyze` | sonnet-4-6 | te zwaar voor structured output |
| `/api/check-in/plan` | sonnet-4-6 | redelijk |
| `/api/check-in/analyze` | sonnet-4-6 | redelijk |
| `memory-extractor` | haiku-4-5 | correct |
| `sync-analyst` | haiku-4-5 | correct |

### 8.2 Kosten bij 100 users × 50 messages/dag × 30 dagen

Aannames (Anthropic public pricing, mei 2026 — bevestig met Context7):
- Sonnet 4.x: $3 input / $15 output / MTok
- Haiku 4.5: $0.80 input / $4 output / MTok
- Cache reads: ~$0.30/MTok (10% van Sonnet)
- Cache writes: ~$3.75/MTok (125% van Sonnet, een keer per cache TTL)

Gemiddelde chat-request nu:
- Input: 4500 (system) + 200 (memory/PRs) + 800 (history × 20 turns) + 100 (user msg) = ~5600 tokens
- Tool round-trips: bij 30% van requests, gemiddeld 2 extra round-trips × 1500 tokens = +900 tokens
- Output: ~400 tokens

**Per chat: ~6500 input + 400 output tokens.**

100 × 50 × 30 = 150.000 chats/maand.

| Scenario | Calculation | $/maand |
|---|---|---|
| Status quo (Sonnet, no cache) | 150k × (6500/1M × $3 + 400/1M × $15) | **$3.825** |
| + Haiku voor simple_greeting (10%) | -10% × $3825 | **$3.443** |
| + Caching 80% van system prompt | 150k × (4500×0.8/1M × ($0.30 − $3) + rest as-is) | **$2.184** |
| + Haiku voor classifier (separate) | +150k × 250/1M × $0.80 | **$2.214** |
| + Haiku voor memory-extractor (already) | – | **$2.214** |
| + Sonnet alleen waar nodig (40% chats genoeg met Haiku) | -40% × $1.4k savings | **$1.654** |
| Optimaal (Opus alleen voor weekly review) | +5 reviews/user/maand × Opus $15/MTok | +$80 → **$1.734** |

**Conclusie:** met prompt caching + smartere model-routing daalt de chat-kostprijs ~55%. **Voor één user (Stef)** is dat: $38/maand → $17/maand. Niet wereldschokkend, maar als je ooit naar 10+ users gaat is het wel relevant.

### 8.3 Concrete model-routing voorstel

```typescript
function selectModel(type: QuestionType, hasToolsExpected: boolean): string {
  // Opus voor diepe analyse (zelden, hoog signaal)
  if (type === 'weekly_review' && isSundayEvening()) return 'claude-opus-4-7'
  // Haiku voor classificatie, greeting, korte nutrition_log responses
  if (type === 'simple_greeting') return MEMORY_MODEL
  if (type === 'nutrition_log' && !hasToolsExpected) return MEMORY_MODEL
  // Sonnet default
  return MODEL
}
```

---

## 9. Top 5 P0 fixes (deze week)

1. **Implementeer prompt caching** op het statische system-prompt blok.
   - Bestand: `src/lib/ai/client.ts:43-51`, `src/lib/ai/prompts/chat-system.ts:234-246`
   - Knip `staticSections` los, geef het mee als `system: [{ type: 'text', text: staticSections, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }, { type: 'text', text: dynamicTail }]`
   - **Besparing: ~55% van input tokens. €1.500/maand bij 100 users.**

2. **Fix classifier-bug "kwark met eiwit-vraag" en "gisteren X kcal"** (test C04, C08).
   - Bestand: `src/lib/ai/classifier.ts:87-92`
   - Volgorde: hasQuestionMark check op nutrition_question moet voor de food-keyword check komen, of: laat food-keywords minder zwaar wegen wanneer een vraagteken aanwezig is.

3. **Vervang XML-write-backs door tools** voor nutrition_log, injury_log, schema_update.
   - Bestand: `src/app/api/chat/route.ts:58-106`, `src/lib/ai/tools/definitions.ts`
   - Voeg `log_nutrition`, `log_injury`, `update_schema` tools toe met Zod inputSchema. Verwijder `extractWritebacks`.
   - Voordeel: schema-validatie, retries, geen stille faal.

4. **Bouw een minimale eval-harness.**
   - Bestand: `scripts/eval-ai.ts` (nieuw)
   - 30 testcases (zie sectie 7). Run via `pnpm tsx scripts/eval-ai.ts`.
   - Maak het een Vercel preview-check op PRs die `src/lib/ai/**` raken.

5. **Limit `loadCoachingMemory` op 30 rows.**
   - Bestand: `src/lib/ai/context-assembler.ts:865-871`
   - Voeg `.limit(30)` toe. Voorkomt token-blowup over 6+ maanden gebruik.

---

## 10. Top 10 P1 verbeteringen (deze maand)

1. **Switch nutrition-analyze naar `generateObject`** uit AI SDK. Eliminert JSON-parse/Zod-parse fallout.
   - Bestand: `src/lib/nutrition/analyze.ts:46-53`, `src/lib/ai/client.ts:57-69`

2. **Voeg input-token + cache-token kolommen toe aan `chat_messages`** + log in route handler.
   - Bestand: nieuwe migratie + `src/app/api/chat/route.ts:266-274`

3. **Conversation history compression.** Bij >15 turns, summarize oudste 10 met Haiku.
   - Bestand: `src/app/api/chat/route.ts:202-211`

4. **Verwijder de dode `assembleContext()` en alle type-specifieke builders** in `context-assembler.ts` als ze niet meer gebruikt worden.
   - Bestand: `src/lib/ai/context-assembler.ts:130-857` (700+ regels dode code)

5. **Voeg ontbrekende read tools toe:** `get_body_composition`, `get_active_schema`, `get_injury_history`, `get_weekly_aggregations`.
   - Bestand: `src/lib/ai/tools/definitions.ts`, nieuwe handlers

6. **Consolideer wekelijkse review:** kies tussen `weekly-summary.ts` (markdown) en `checkin-analyze.ts` (JSON). Verwijder de niet-gekozen.
   - Bestand: `src/lib/ai/prompts/weekly-summary.ts`, `src/lib/ai/skills/router.ts:47-48`

7. **Response length policy in chat-system prompt.** Voeg sectie 12 toe (zie 2.1).
   - Bestand: `src/lib/ai/prompts/chat-system.ts:11-144`

8. **Fix `result.usage` error in stream-handler.** Wrap in try/catch zodat assistant message altijd wordt opgeslagen.
   - Bestand: `src/app/api/chat/route.ts:266`

9. **Recency-decay voor coaching_memory.** Memories >60 dagen niet meer in default-laad, archiveer naar aparte tabel.
   - Migratie + `src/lib/ai/context-assembler.ts:863-887`

10. **Skill prompt deduplicatie strakker.** De `skills.some(s => s.includes('WORKOUT ANALYSE'))` check (`skills/router.ts:65`) is fragiel. Maak skills een Set keyed by name.
    - Bestand: `src/lib/ai/skills/router.ts:37-71`

---

## Direct uitvoerbare acties (max 5)

1. **Vandaag (2-3u):** schrijf `scripts/eval-ai.ts` met de 10 classifier-tests uit sectie 7 en run het. Identificeer welke bugs (C04, C08, C09) écht in productie zitten.
2. **Deze week (4-6u):** implementeer Anthropic prompt caching in `chat-system.ts` + `client.ts`. Test met `/api/chat` op staging, verifieer in Anthropic console dat cache reads > 0 zijn.
3. **Deze week (4-6u):** vervang `<nutrition_log>`-XML door een `log_nutrition` tool. Behoud backwards-compat parser tijdelijk; verwijder na 1 week zonder gebruik.
4. **Deze sprint (1d):** voeg de 4 ontbrekende read tools toe (`get_body_composition`, `get_active_schema`, `get_injury_history`, `get_weekly_aggregations`).
5. **Deze sprint (2u):** voeg `.limit(30)` aan `loadCoachingMemory` en log token-usage in `chat_messages`. Snelle wins met meetbare impact.

---

## Open vragen voor Stef

1. **Multi-user voorbereid?** De prompt is single-user (jouw persoonlijke data hardcoded). Als je naar 2+ users gaat: alles uit `chat-system.ts:11-143` moet uit het system-prompt en in `coaching_memory`/`profiles`. Wil je nu al die migratie maken, of single-user pragmatisch laten?
2. **Schema-generation flow.** Wil je dat een nieuw schema écht alléén bij expliciete bevestiging wordt aangemaakt? Nu kan Claude per ongeluk een `<schema_generation>` blok produceren bij een vraag. Strenger maken (laat het altijd via /api/check-in/plan lopen) of houden zoals het is?
3. **Eval-harness als CI?** Wil je dat PRs die `src/lib/ai/**` raken automatisch falen bij regressies (Vercel preview check), of alleen handmatig runnen voor de zekerheid?
4. **Opus voor weekly review zondagavond?** Kost ~€20/maand extra voor jou alleen (52 reviews/jaar × Opus pricing). Waardevoller dan Sonnet, of niet de moeite waard?
5. **Memory archival policy.** Wat moet er gebeuren met coaching memories >60 dagen oud die nooit meer worden gerefereerd? Stille delete, archiveer naar `coaching_memory_archive`, of laten staan?
6. **Welk model-default na router-rewrite?** Als je tool-driven write-backs invoert, kan een groot deel van de chats wellicht op Haiku (kortere outputs, minder reasoning). Wil je een experiment doen met Haiku-first + Sonnet-fallback bij specifieke intents?

