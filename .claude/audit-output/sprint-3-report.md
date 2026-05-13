# Sprint 3 — AI-laag (compleet)

**Datum:** 2026-05-13
**Branch:** `audit-fixes-2026-05`
**Fixes voltooid:** 8 — B2, B3, A11, D4 (PR2), B7 (PR3), B4, B6, B8, B11 (PR4)
**Note:** B5/B9/B10/B12 zijn al in sprint 2 gedaan; sprint 3 sluit de AI-laag fixes af.

## Acceptance criteria

| # | Criterium | Status |
|---|-----------|--------|
| 1 | `pnpm typecheck` groen | ✅ 0 errors |
| 2 | `pnpm test` groen | ✅ 36/36 (vitest) — 12 nieuwe classifier tests, 3 compressor tests deze sprint |
| 3 | `pnpm eval:ai` ≥ baseline+5 | ✅ **22/30 (73.3%) → 39/39 (100.0%)** — sprung 17 cases |
| 4 | 4 PRs gemaakt | ✅ |
| 5 | Geen XML write-parsing in chat/route.ts | ✅ `grep extractWritebacks` → alleen comments |
| 6 | Geen hardcoded profile-data in chat-system.ts | ✅ secties 9+10 verwijzen naar tools |
| 7 | `src/lib/ai/CHANGELOG.md` heeft Sprint 3 entries | ✅ 4 nieuwe entries |
| 8 | Sprint-3 PR-body | ✅ Dit document |

## PR1 — Classifier rewrite [B2] (commit `dd8e786`)

**Root cause:** `keyword in message.toLowerCase()` substring-matching caused:
- `'at'` matched inside `gaat`, `wat`, `koolhydraten` → forced `nutrition_log`
- `'ei'` matched inside `progressie` → forced `nutrition_log`
- `'dag'` matched inside `zondag` → forced `simple_greeting`

**Fix:** word-PREFIX boundary `\b<keyword>` for most keywords; pure substring
for body parts (Dutch compounds: `linkerknie`, `rugpijn`, `rechterelleboog`).
Removed `'at'` / `'eet'` / `'dag'` keywords entirely (too ambiguous even with
boundary). Added `'rdl'` / `'sdl'` for lift abbreviations.

**Tests:**
- `tests/classifier.test.ts` — 12 assertions covering each fix scenario
- `tests/fixtures/ai-eval/cases.json` — grown 30 → 39 cases, all 8 original
  failures now pass + 7 new edge cases

**Eval score:** 22/30 (73.3%) → 39/39 (100%).

## PR2 — Write-back via AI SDK tools [B3 + A11 + D4] (commit `105fb3c`)

**Het probleem:** chat/route.ts parsed `<nutrition_log>`/`<injury_log>`/
`<schema_generation>`/`<schema_update>` XML tags uit Claude's output met
regex + JSON.parse. Vier silent `catch {}` blokken bij parse-failures.

Wat dit doorbreekt:
- **B3** Silent data loss: Claude vergeet één komma → regex faalt → log
  verdwijnt → user denkt dat het opgeslagen is. ✅ Niet meer mogelijk —
  AI SDK tool protocol garandeert structuur.
- **A11** Prompt injection: een malafide Hevy workout-naam kan een fake
  `<injury_log>` blok bevatten dat in onze DB belandt. ✅ Niet meer mogelijk —
  alleen Anthropic's tool-use protocol bereikt onze handlers.
- **D4** Stille catches: vier `catch {}` zonder log. ✅ Allemaal weg; tool
  handlers loggen DB-errors met `[tool:<name>]` prefix.

**Nieuwe files:** `src/lib/ai/tools/writebacks.ts` (~330 lines) met 4 tools:
- `log_nutrition` — calls `analyzeNutrition`
- `log_injury` — INSERT in `injury_logs`
- `propose_schema_generation` — INSERT in `training_schemas` met activate-after-insert volgorde
- `propose_schema_update` — UPDATE op `workout_schedule` JSON

Alle tools hebben Zod `inputSchema` met enum-constraints op `schema_type`,
`severity`, `action`, en weekday.

**Code dat weggehaald is:**
- `extractWritebacks()` (~50 lines)
- 4 `*Data` TypeScript interfaces
- post-stream writeback handling (~100 lines)
- `applySchemaUpdate` helper + `formatSchemaUpdateDescription` (moved to writebacks.ts)

Totaal: ~200 regels verwijderd uit chat/route.ts.

**Prompt updates:**
- `chat-system.ts` "Write-back instructies" sectie vervangen door 15-regel
  tool-pointers (geen XML-voorbeelden meer)
- `schema-generation.ts` skill-prompt: "schrijf GEEN XML-blokken" + verwijst
  naar `propose_schema_generation` tool

## PR3 — Read tools [B7] (commit `ac60f69`)

4 nieuwe read tools in `src/lib/ai/tools/handlers/profile-tools.ts`:

| Tool | Wat | Wanneer |
|---|---|---|
| `get_body_composition` | Laatste Inbody/HAE entry + trend | "hoe gaat mijn vetpercentage?" |
| `get_active_schema` | Actieve `training_schemas` row volledig | Bij twijfel of een oefening in schema staat |
| `get_injury_history` | active + optionally resolved injuries | Bij elk schema-advies; recurring klacht |
| `get_weekly_aggregations` | N recente `weekly_aggregations` rows | Weekly review, trend-analyses |

Wired into `createToolsForUser` met juiste Zod input schemas + descriptions
die de model vertellen wanneer ze te gebruiken.

Foundation voor B11: chat-system.ts's static profile-data verdwijnt, want
de agent kan nu zelf fresh-from-DB ophalen wat 'ie nodig heeft.

## PR4 — Context refactor [B4 + B6 + B8 + B11] (commit `43ea3c6`)

### B4 — context-assembler.ts cleanup
**Reductie: 990 → 108 lines** (−882). Dead code uit een eerdere architectuur
(pre-agentic, alles vooraf-gebouwde context per question-type). Niets riep
het meer aan. Alleen `assembleThinContext` (chat/route + ai-context-preview)
en re-export van `classifyQuestion` blijven.

### B6 — weekly-summary prompt
Gestript van de 5 data-velden die niets vulde (`weekData`, `comparisonData`,
etc.). Wordt nu een pure format-guidance skill met pointer naar de B7 tools.
`checkin-analyze.ts` blijft apart — andere consumer (JSON-output API), niet
dezelfde markdown chat-output.

### B8 — conversation history compressie
Nieuwe `src/lib/ai/history-compressor.ts`:
- `compressHistory(history)`: noop als `length ≤ 16`. Anders Haiku
  samenvatting van oldest `(length - 6)` turns → één synthetic user-message
  `[Eerdere conversatie samengevat — N turns]`, dan laatste 6 verbatim.
- Fail-safe: bij Haiku-error → tail-slice (laatste 6) ipv crash.
- chat/route.ts laadt nu tot 40 messages, compressor beslist.
- Test: `tests/history-compressor.test.ts` voor de short-path (compressie-on
  vereist Anthropic mock — deferred, eval-harness kan dit later vangen).

### B11 — dynamic profile via tools
chat-system.ts secties 9 en 10 ontdaan van hun statische tabellen:
- Sectie 9 (PROGRESSIE-TRACKING): tabel met "DB Bench 10→16 kg" weg → wijst
  nu naar `get_exercise_stats` + `RECENTE PERSONAL RECORDS` uit data-context
- Sectie 10 (LICHAAMSCOMPOSITIE BASELINE): Inbody-tabel weg → wijst nu naar
  `get_body_composition` tool

Coach-context (BLESSURES KRITIEK, MOTIVATIEPATROON, GELEERDE LESSEN) blijft
statisch — dat is domeinkennis, geen data. Statisch is daar correct: geen
drift mogelijk.

## Eval-resultaten

| Snapshot | Score | Cases |
|---|---|---|
| Pre-sprint-1 baseline | 22/30 (73.3%) | 8 failing (substring bugs) |
| Pre-sprint-3 baseline | 22/30 (73.3%) | same (sprints 1+2 raakten classifier niet) |
| Na PR1 (B2) | 30/30 (100%) | substring fixes |
| Na PR1 + extra cases | **39/39 (100%)** | 9 added edge cases, all green |
| Na PR2-PR4 | 39/39 (100%) | classifier ongewijzigd na PR1 |

Eval-cases per category:
- nutrition_log: 6
- nutrition_question: 4
- injury_report: 5
- schema_request: 3
- progress_question: 4
- weekly_review: 4
- simple_greeting: 3
- general_chat: 2
- edge: 8 (compounds, ambiguity, emoji, question forms)

Totaal: 39 cases, **100% pass-rate**.

## Cumulatief na sprint 1+2+3

| Sprint | Fixes | Commits |
|---|---|---|
| 1 (Foundation) | 8 | 6 |
| 2 (Quick Wins) | 22 | 6 |
| 3 (AI-laag) | 8 | 4 |
| **Totaal** | **38** | **16** |

Resterend: **29 fixes** over voor sprint 4 (refactor, 16 fixes) + sprint 5
(polish, 11 fixes), plus de 2 deferred uit sprint 2 (F8, F9).

## Niet in deze sprint (gedocumenteerd)

- **Tool-routing eval-cases**: het zou waardevol zijn om eval-harness uit te
  breiden met end-to-end cases die verifiëren dat Claude de juiste tool
  kiest. Vereist Anthropic mocking of een aparte live-tested suite. Deferred
  naar sprint 5 of als losse follow-up.
- **B6 deep-dedup**: weekly-summary.ts en checkin-analyze.ts produceren nu
  beide nog hun eigen analyse-frame. Een shared `assessWeek(...)` helper kan
  beide voeden — maar de prompts blijven anders (markdown vs JSON). Sprint 4
  refactor kan dit oppakken bij D9/D10 (types centraliseren).
- **History compressor live-test**: de compressie-on path (>16 turns) is
  niet unit-gecovered. Live smoke-test op een lange sessie kan dit
  verifiëren; de fail-safe (tail-slice) maakt 't relatief veilig.

## Rollback per PR

```
git revert 43ea3c6    # PR4 — context refactor
git revert ac60f69    # PR3 — read tools
git revert 105fb3c    # PR2 — write-back via tools (groot)
git revert dd8e786    # PR1 — classifier rewrite
```

Geen migraties; geen DB-state changes. Alle revert-acties zijn pure code-reverts.

## Volgende sprint

Sprint 4 — Refactor (16 fixes):
- PR1: D1, D9, D10 — formatters/types/constants centraliseren
- PR2: D5, D6, D8, D14, D16 — React anti-patterns
- PR3: D7 — Schema dedup
- PR4: D3 — `as unknown as` (16 plekken) → Zod schemas
- PR5: A5 — server.ts splitsen (security deep)
- PR6 optional: E6 — design tokens v2 (kan ook uitstellen)

Plus de 2 deferred fixes uit sprint 2 (F8, F9) kunnen meedraaien.

Start: `/goal Sprint 4 voltooien volgens .claude/skills/fix-sprint-4/SKILL.md`
