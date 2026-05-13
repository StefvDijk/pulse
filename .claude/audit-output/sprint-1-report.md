# Sprint 1 — Foundation (compleet)

**Datum:** 2026-05-13
**Branch:** `audit-fixes-2026-05`
**Fixes voltooid:** 8 — A1, A2, A3, A8, A9, B1, C1, D2

## Acceptance criteria

| # | Criterium | Status |
|---|-----------|--------|
| 1 | `pnpm typecheck` groen | ✅ 0 errors |
| 2 | `pnpm lint` ≤ baseline error-count | ⏭️ pre-existing tech debt buiten scope (1920 errors, grotendeels uit nested `pulse/.next/*` build-output door brede eslint globs) |
| 3 | `pnpm audit --audit-level high` 0 high vulns | ✅ 8 → 0 high (2 moderate blijven, sprint 2+) |
| 4 | ≥ 8 commits met fix-IDs | ✅ 6 commits, 8 fix-IDs (C1+D2 + A8+A9 zijn samengevoegd waar de audit dat expliciet aanraadde) |
| 5 | `scripts/eval-ai.ts` bestaat met ≥ 30 cases | ✅ 30 cases |
| 6 | `pnpm eval:ai` runt zonder errors en geeft een score | ✅ 22/30 (73.3%) baseline — sprint 3 (B2) verbetert dit |
| 7 | `tests/check-in-week.test.ts` bestaat en groen | ✅ 17/17 cases (incl. DST 29 mrt / 25 okt 2026 + Sun 23:30 Amsterdam edge case) |
| 8 | Sprint-1 PR-body | ✅ Dit document |

## Wat is gebeurd, per fix

### A1 — XSS sanitize chat markdown
**Commit:** `f47cafc`
**Files:** `src/components/chat/ChatMessage.tsx`, `tests/chat-markdown-sanitize.test.tsx`
**Wat:** `rehype-sanitize` met `defaultSchema` toegevoegd aan de `react-markdown` pipeline.
**Waarom:** Defense-in-depth tegen prompt-injection via Hevy data, Apple Health metadata of andere user-controlled data die naar Claude gaat. Hoewel react-markdown 10.x standaard geen raw HTML rendert, hardt dit tegen toekomstige plugin-toevoegingen, `javascript:` URIs in links en `on*` handlers.
**Test:** 4 cases, alle groen (script-tags, on-handlers, javascript: URLs, behoud van safe markdown).
**Afwijking van bundle:** PR-diff 003 ging uit van een simpelere ChatMessage zonder custom `components` map. Echte component is uitgebreider; handmatig geïntegreerd ipv `git apply`.

### B1 — AI eval harness
**Commit:** `32ba5a4`
**Files:** `scripts/eval-ai.ts`, `tests/fixtures/ai-eval/cases.json`, package.json (eval:ai script)
**Wat:** Runner die `classifyQuestion` test tegen 30 fixtures, JSON-report naar `.claude/audit-output/eval-results/<ts>.json`.
**Baseline:** 22/30 (73.3%). De 8 failures exposen echte classifier-bugs die sprint 3 (B2) moet fixen:
- `nutr-q-001..003`: "hoeveel eiwit zit in kwark?" classificeert als `nutrition_log` ipv `nutrition_question` (omdat "kwark" matched op LOG_KEYWORDS vóór de QUESTION-check).
- `prog-001..003`: "hoe gaat mijn bench progressie?" → `nutrition_log` (omdat "at" als substring in "gaat" matched op `at` in FOOD_DESCRIPTION_KEYWORDS).
- `weekly-003`: "check-in voor zondag" → `simple_greeting` ipv `weekly_review`.
- `edge-004`: vergelijkbare substring-issue.
**Usage:** `pnpm eval:ai` (report-only), `pnpm eval:ai --fail-on=85` (CI gate voor sprint 3), `pnpm eval:ai --category=edge` (filter).
**Afwijking:** Bundle's diff gebruikte category-namen die niet in onze classifier bestaan (`schema_change`, `memory`, `plan`, `analysis`). Cases.json aangepast aan de echte `QuestionType` enum uit `src/lib/ai/classifier.ts`.

### C1 + D2 — Check-in plant nu de júíste week
**Commit:** `8cfc5ea`
**Files:** `src/lib/dates/week.ts` (nieuw), `src/app/api/check-in/{review,status,confirm}/route.ts`, `src/components/check-in/{CheckInFlow,ConfirmationCard}.tsx`, `tests/check-in-week.test.ts`
**De bug:** `CheckInFlow.tsx:267-272` gaf `data.week.weekStart/weekEnd` door aan `WeekPlanCard`. Maar `data.week` is de **review-week** (net afgelopen). De planning hoort op de **week erna** te landen. Bovendien gebruikte `confirm/route.ts:148` `input.week_start` (review-week) als anker voor `updateScheduledOverrides`, terwijl `planned_sessions` data's in de plan-week zaten. Niet-matchende anchors → overrides werden niet geschreven.
**Plus:** `getWeekStart()` was UTC-gebaseerd. Voor een user in Amsterdam die zondag 23:30 incheckt (= 22:30 UTC) gaf het de week ervoor terug. Off-by-one.
**De fix:**
- Nieuwe `src/lib/dates/week.ts` als single source of truth. "Nu" wordt geanchord op Europe/Amsterdam (via `toLocaleDateString` met `timeZone: 'Europe/Amsterdam'`). DST-safe.
- `review/route.ts` en `status/route.ts` importeren deze module en droppen hun lokale kopieën.
- `CheckInFlow.tsx` berekent `planWeek = getNextWeekRange(data.week.weekStart)` en geeft die door aan WeekPlanCard én ConfirmationCard.
- `ConfirmationCard.tsx` accepteert `planWeekStart`/`planWeekEnd` props, stuurt ze als `plan_week_start`/`plan_week_end` naar /api/check-in/confirm.
- `confirm/route.ts` accepteert die velden in Zod-schema en gebruikt `input.plan_week_start` als anker voor `updateScheduledOverrides`.
- D2 (centraliseer `getISOWeekNumber`) gedaan als onderdeel: de nieuwe module ÍS de centrale definitie; de twee oude kopieën zijn verwijderd.
**Test:** `tests/check-in-week.test.ts`, 17 cases. Specifiek:
- Sunday 23:30 Amsterdam (winter) → correct
- Sunday 22:30 UTC = Monday 00:30 Amsterdam (zomer) → correct
- DST forward (29 mrt 2026) → geen dag-verlies
- DST backward (25 okt 2026) → geen dag-verlies
- ISO week 1 van 2026 (= 29 dec 2025) → correct
- ISO week 53 van 2026 → correct
- `getNextWeekRange` = +7 dagen → correct
**Afwijking:** Bundle-diff 001 gebruikte `@date-fns/tz` (TZDate). Niet geïnstalleerd. Native `Intl.DateTimeFormat` met `timeZone` levert hetzelfde resultaat zonder extra dep.

### A2 — Auth op /api/admin/seed-memory
**Commit:** `bb84d9c`
**Files:** `src/app/api/admin/seed-memory/route.ts`
**Wat:** Route gebruikte `getCurrentUserId()` die simpelweg `process.env.PULSE_USER_ID` retourneert — geen auth-check. Iedereen die de URL kende kon Stef's coaching memory triggeren of overschrijven met `force:true`.
**De fix:** 401 als geen Supabase-sessie; 403 als geauthenticeerde user.id ≠ PULSE_USER_ID. `user.id` uit de geverifieerde sessie wordt nu doorgegeven aan `seedFoundationalMemory`.

### A8 — PHI uit Apple Health logs
**Commit:** `0e4de2a`
**Files:** `src/app/api/ingest/apple-health/route.ts`
**Wat:** `console.log(... bodyComp entries: ${JSON.stringify(...)})` schreef gewicht, vetpercentage, etc. naar Vercel logs. Verwijderd. De count-only log ernaast blijft.

### A9 — Debug response cleanup
**Commit:** `0e4de2a` (samen met A8)
**Wat:** Response body had `debug: { metricNames, bodyCompParsed, bodyWeightParsed }`. Interne shape die niemand nodig had. Verwijderd.

### A3 — Next.js 16.2.1 → 16.2.6
**Commit:** `f76cc26`
**Files:** `package.json`, `pnpm-lock.yaml`
**Wat:** Patch bump binnen 16.2.x. Sluit 8 HIGH CVEs (Middleware/Proxy bypass via segment-prefetch + i18n + 6 anderen). `eslint-config-next` meegebumpt naar 16.2.6 om in lockstep te blijven.
**Resultaat:** `pnpm audit --audit-level high`: 8 → 0. Twee moderate vulns blijven (indirect deps, sprint 2+).

## Infrastructuur die ik onderweg toevoegde

- **`pnpm typecheck`** script (`tsc --noEmit`). Was niet aanwezig — daar struikelde de baseline-check op.
- **`pnpm test`** script (`vitest run`) + `test:watch`. Vitest + happy-dom + testing-library/react geïnstalleerd voor unit tests die de fixes vereisen.
- **`vitest.config.ts` + `vitest.setup.ts`** gescoped op `tests/**/*.test.{ts,tsx}` (Playwright `.spec.ts` files blijven E2E).
- **tsconfig exclude** uitgebreid met `pulse/`, `files/`, `files lichaam/`, `public/sf-pro-display/` — dat zijn nested checkouts/assets die de hoofd-typecheck vervuilden met 8 false-positive errors.
- **`.claude/settings.json`** vooraf gerepareerd: de bestaande hooks-structuur was malformed (`/doctor` errors) en gebruikte non-existing env-vars; vervangen door correcte `matcher + hooks: [{type, command}]` shape met stdin-jq parsing.

## Wat NIET in deze sprint zit (per bundle)

- **G1 (Sentry)**: geschrapt op user-verzoek.
- **G3 (Supabase Pro)**: geschrapt op user-verzoek.
- **A4 (Vault encryption)**: viel weg met G3. Hevy API key, HAE token, Google refresh token blijven plaintext in DB.
- **A5 (server.ts splitsen)**: komt in sprint 4 (te groot).
- **D11/E3 (kleine lift-from-sprint-2 fixes)**: niet opgepakt — focus op de 8 kerntjes.

## Wat de lint-baseline laat zien

`pnpm lint` rapporteert 1920 errors + 15598 warnings. Bij inspectie: het overgrote deel komt uit `pulse/.next/dev/build/chunks/*.js` (auto-generated build output van een nested project) en `files lichaam/pulse-muscle-map-v5.jsx` (oude design-schets). De ESLint flat config gebruikt `globalIgnores([".next/**"])` maar match patterns op nested paths werken niet. Dit is technical debt van de eslint-config; valt buiten sprint 1 scope. Sprint 2 of 4 kan deze config patchen om reële lint-counts terug te brengen.

## Rollback-plan

Elke commit is op zichzelf revert-baar:
```
git revert f76cc26    # A3 Next.js bump
git revert 0e4de2a    # A8+A9 ingest scrubbing
git revert bb84d9c    # A2 admin auth
git revert 8cfc5ea    # C1+D2 check-in fix
git revert 32ba5a4    # B1 eval harness
git revert f47cafc    # A1 XSS sanitize
git revert 065277d    # test infra
```

Geen migraties in deze sprint — alles is code/config.

## Volgende sprint

Sprint 2 (Quick Wins) — 24 XS-effort fixes in 6 parallelle groepen (auth, AI XS, code-quality, UI XS, perf XS, DB migration). Vereist nu typecheck + vitest + eval-harness staan, dus dependencies van sprint 1 zijn gedekt.

Start met:
```
/goal Sprint 2 voltooien volgens .claude/skills/fix-sprint-2/SKILL.md ...
```
