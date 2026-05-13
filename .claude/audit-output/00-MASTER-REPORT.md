# Pulse Audit — Master Report

**Datum:** 2026-05-13
**Scope:** complete codebase, AI-laag, UI/UX, security, performance, productie-gereedheid, sports-product fit, check-in-bug RCA.
**Audit owner:** Senior full-stack engineer + product manager + security auditor + sports-app expert in één.
**Doel:** een eerlijk beeld geven van waar Pulse staat, wat fout is, en wat te doen — geen vleierij.

---

## 1. Executive Summary (één pagina)

Pulse is technisch verder dan je zou denken voor een solo-bouwer: alle bronnen lopen door, de data-pipeline draait, de UI is grotendeels netjes, RLS staat op alle 23 tabellen, en de AI-laag is daadwerkelijk agentic (tool-use, streaming, write-back). De ambitie van de app — één coach die alles van je sport-leven begrijpt — is écht uniek in de markt.

Maar de app is **niet klaar voor productie met 100+ betalende klanten**, en de specifieke onvrede van Stef over de AI-laag is volkomen terecht. Drie diepere problemen lopen door alle audit-fases heen:

1. **Geen evals, geen prompt caching, twee parallelle write-mechanismen.** De AI-laag werkt vandaag voor één gebruiker maar is structureel niet meet- of bestuurbaar. Dit is waarom Stef geen vertrouwen heeft: er is geen manier om regressies te zien. Bovendien gaat dezelfde 4.500-token system prompt bij elke chat-request opnieuw door de wire — bij 100 users × 50 chats/dag is dat ongeveer **€1.500/maand verspilling**.

2. **Productie-blockers stapelen op:** geen Stripe, geen Sentry, geen password-reset, 3 cron jobs op Vercel Hobby (limit = 2), Apple Health data plaintext in DB, geen GDPR-export/delete, geen privacy policy of medische disclaimer. Niets hiervan is fundamenteel zwaar werk, maar er is nu nul van.

3. **De check-in wizard plant structureel de verkeerde week.** Root cause is gevonden en gefixed (zie `08-checkin-bug-rca.md` en `prs/001-fix-checkin-week-calculation.diff`): de planner krijgt de review-week i.p.v. review-week + 7 dagen.

Daarnaast als product: Pulse zit in een lastige tussenpositie. Hevy doet 80% voor $24/jaar, Whoop verkoopt premium voor $200. Pulse's USP is écht (cross-context AI coach) maar de tafel-stakes ontbreken: geen onboarding, geen push notifications, geen native app, geen Garmin/Whoop ingest. Voor Stef persoonlijk: blijven bouwen. Voor SaaS-launch: eerst die 5 dingen, dán launchen.

**Productie-gereedheid:** ❌ **no-go** voor 100+ users. Met focus is dit een **8 weken** sprint naar minimaal levensvatbaar. Met de huidige roadmap zonder prioritering: 4-6 maanden.

---

## 2. Top 10 P0 issues (must-fix vóór elke vorm van betaal-launch)

| # | Issue | Bron | Bestand:regel | Tijd | PR-diff |
|---|---|---|---|---|---|
| P0-1 | **Check-in plant verkeerde week** | Fase 8 | `CheckInFlow.tsx:270-271`, `review/route.ts:77-84,273` | 4u | `prs/001` |
| P0-2 | **`react-markdown` zonder `rehype-sanitize` → XSS via prompt-injection** | Fase 4 | `ChatMessage.tsx:28` | 30 min | `prs/003` |
| P0-3 | **`/api/admin/seed-memory` is publiek bereikbaar (geen auth)** | Fase 4 | `src/app/api/admin/seed-memory/route.ts` | 30 min | — |
| P0-4 | **`createClient()` retourneert service-role overal server-side; RLS bypassed by design** | Fase 4 | `src/lib/supabase/server.ts:8-21` | 1 dag | — |
| P0-5 | **Hevy keys, HAE tokens, Google refresh tokens plaintext in DB** | Fase 4 | `user_settings`, `google_oauth_tokens` | 1 dag | — |
| P0-6 | **Next.js 16.2.1 → 6 HIGH CVEs (middleware bypass, SSRF)** | Fase 4 | `package.json` | 1u | — |
| P0-7 | **Vercel Hobby limiet = 2 cron jobs; we hebben er 3 in `vercel.json`** | Fase 6 | `vercel.json` | 1u | — |
| P0-8 | **`HEVY_API_KEY` env-fallback in `src/lib/hevy/sync.ts` → multi-tenant lekrisico** | Fase 6 | `src/lib/hevy/sync.ts` | 30 min | — |
| P0-9 | **3 `console.log` calls loggen gezondheidsdata naar Vercel logs** | Fase 1 | `src/app/api/ingest/apple-health/route.ts:155-166` | 15 min | — |
| P0-10 | **Geen Sentry / error tracking; 111 `console.log` in src/** | Fase 6 | hele codebase | 1 dag | — |

**Totale werk-inschatting P0:** ~6 dagen werk voor één developer. Niet onmogelijk.

---

## 3. Top 10 P1 issues (should-fix binnen 4 weken)

| # | Issue | Bron | Locatie |
|---|---|---|---|
| P1-1 | **Geen AI eval-harness** — geen regressie-vangnet voor de coach | Fase 2 | — (nieuw: `scripts/eval-ai.ts`, zie `prs/002`) |
| P1-2 | **Geen prompt caching** — €1.500/mo verspild bij 100 users | Fase 2 | `src/app/api/chat/route.ts`, `src/lib/ai/prompts/*` |
| P1-3 | **Classifier is keyword-regex met aantoonbare bugs** ("hoeveel eiwit in kwark?" → nutrition_log) | Fase 2 | `src/lib/ai/classifier.ts:87-92` |
| P1-4 | **Twee parallelle write-mechanismen** (Zod-tools vs XML-blokken met regex) | Fase 2 | `src/app/api/chat/route.ts:58` |
| P1-5 | **988-regel context-assembler waarvan 700+ regels dood** | Fase 2 | `src/lib/ai/context-assembler.ts` |
| P1-6 | **Lege home voor nieuwe user — 4 home-cards renderen `null`** | Fase 3 | `TodayWorkoutCard`, `ReadinessSignal`, `WeekAtAGlance`, `DailyHealthBar` |
| P1-7 | **Design tokens v2 niet doorgevoerd** — 316 component-refs gebruiken nog v1 Apple HIG-kleuren | Fase 3 | hele `src/components/` |
| P1-8 | **`hevy-sync/route.ts` is sequentieel** — timeout bij >30 users | Fase 6 | `src/lib/hevy/sync.ts:46` |
| P1-9 | **`workout_exercises(exercise_definition_id)` index ontbreekt; idem `personal_records(workout_id)`** | Fase 5 | `supabase/migrations/` |
| P1-10 | **Geen onboarding wizard** — nieuwe user landt op lege home, geeft op binnen 60 sec | Fase 3 + 7 | `src/app/auth/signup/`, missing |

---

## 4. Top 5 quick wins (< 2 uur werk elk)

1. **`prs/003-sanitize-chat-markdown-xss.diff` mergen** — 30 min. Blokkeert XSS-vector die je elk moment kan raken. (Fase 4.)
2. **`themeColor: '#F2F2F7'` → `'#15171F'` in `layout.tsx:26`** — 30 sec. iOS-status-bar matcht dan eindelijk dark-mode. (Fase 3.)
3. **Verwijder 3 `console.log` in `ingest/apple-health/route.ts:155-166`** — 5 min. Stopt PHI-lekken naar Vercel logs. (Fase 1.)
4. **Verwijder dubbele `pb-24` + `pb-[83px]`** op 5 routes — 30 min. Geeft ~180px ruimte terug op mobiel. (Fase 3.)
5. **Voeg `revalidateOnFocus: false` toe aan `useExerciseList` en `useBodyComposition`** — 5 min. Bespaart onnodige requests op static data. (Fase 5.)

---

## 5. AI-laag verbetervoorstel (één alinea)

De huidige AI-laag is een prototype geschaald tot productie zonder de meetinfrastructuur die productie eist. Drie ingrepen samen lossen 80% op: (1) splits system prompts in `staticSections` (gecached met Anthropic's `cache_control: ephemeral`) en `dynamicSections` (per-user context) — direct ~75% kostenbesparing op herhaalde sessies; (2) vervang de keyword-classifier door een Haiku-classifier (fallback naar regex bij twijfel) of door tool-only routing waar Sonnet zelf via `tool_choice` kiest; (3) wire `scripts/eval-ai.ts` (zie `prs/002`) in CI met een minimum pass-rate van 85% op 30 testcases voordat een prompt-wijziging mag mergen. Tegelijkertijd: schrap een van de twee write-paden (kies de Zod-tools, gooi de XML-blokken weg) en cap `loadCoachingMemory` op de top-20 items op recency × relevance. Resultaat: meetbaar, goedkoper, en je weet wanneer iets regredeerde voordat een user 't ziet.

---

## 6. Productie-gereedheid voor 100+ klanten: **NO-GO**

| Categorie | Status | Belangrijkste blocker |
|---|:-:|---|
| Infra (Vercel/Supabase tier) | ❌ | Cron limit + Supabase Free 500MB = ~10 users max |
| Multi-tenancy / RLS | ⚠️ | RLS aanwezig maar service-role default neutraliseert het |
| Onboarding | ❌ | Geen onboarding wizard; lege home = direct opgeven |
| Billing (Stripe) | ❌ | Niets aanwezig |
| Email (transactional) | ❌ | Geen custom SMTP; Supabase default rate-limited |
| Observability | ❌ | Geen Sentry, geen structured logging |
| GDPR (export/delete) | ❌ | Geen endpoint |
| Legal (privacy/ToS/disclaimer) | ❌ | Niets aanwezig; health data = AVG art. 9 |
| Rate limiting | ❌ | In-memory limiter, werkt niet op Edge / multi-region |
| Backups (PITR) | ⚠️ | Supabase daily backup, geen PITR plan |
| Support | ❌ | Geen helpdesk, geen in-app feedback |

**Conclusie:** met focus is dit een **8-wekenroadmap**, niet 8 maanden. Maar 8 weken focus, geen 8 weken "ook nog feature X".

---

## 7. Roadmap-suggestie

### 4 weken — "Veiligheid en stop-de-bloeding"
- Week 1: P0-1 (check-in week-fix), P0-2 (sanitize), P0-3 (admin auth), P0-6 (Next.js upgrade), P0-9 (logs PHI), P0-10 (Sentry).
- Week 2: P0-4 (service-role only voor cron/admin paths, anon-client als default), P0-5 (Supabase Vault voor tokens), P0-7 (cron consolidatie of Vercel Pro), P0-8 (env-fallback verwijderen).
- Week 3: P1-1 + P1-2 (AI eval harness + prompt caching) — meetbaar maken vóór tunen.
- Week 4: P1-3, P1-4, P1-5 (classifier rewrite + één write-path + dead-code purge).

### 4 weken extra — "Productie-fundament + onboarding" (week 5-8)
- Week 5: P1-6 + P1-10 (onboarding wizard + empty states).
- Week 6: GDPR export+delete, privacy policy, ToS, medische disclaimer.
- Week 7: Stripe + 3 tiers (free / pro €7.99 / performance €14.99 — zie Fase 7).
- Week 8: Native wrapper (Expo) + push notifications. **Hier mag het closed-beta van 30 mensen draaien.**

### 4 weken finetune — "Markt-fit" (week 9-12, gelijktijdig met beta)
- Garmin / Whoop / Oura ingest (één per week).
- Habit streaks UI.
- Siri Shortcut voor quick-log.
- Schrap-lijst doorvoeren (`/belasting` achter Advanced, `/trends` mergen, home naar 3 blokken).
- Build-in-public content op /r/AdvancedFitness en DC Rainmaker outreach.

**Realistisch resultaat na 12 weken:** beta-launch met 30-50 users, ~€500 MRR, gedragen door echte usage en eval-harness die de coach onder controle houdt.

---

## 8. Architectuur-overzicht (kort)

- **App routes:** `/`, `/chat`, `/workouts`, `/schema`, `/progress`, `/goals`, `/check-in`, `/belasting`, `/nutrition`, `/settings`, `/auth/*`, plus `/check-in/history`.
- **API surface:** ~35 route handlers waarvan de belangrijkste: `/api/chat` (AI streaming), `/api/check-in/*` (5 endpoints), `/api/cron/*` (3 jobs), `/api/ingest/{hevy,apple-health}`.
- **Lib structuur:** `src/lib/{ai,hevy,apple-health,google,muscle-map,nutrition,aggregations,goals,wger,supabase}/`.
- **DB:** 23 tabellen, RLS overal, FK-cascade vanaf `profiles`. 21/24 gewenste indexes aanwezig.
- **Crons:** Hevy sync (dagelijks 06:00 UTC), daily-aggregate (02:00 UTC), weekly-aggregate (ma 03:00 UTC).
- **AI:** Anthropic SDK + Vercel AI SDK, Sonnet als default model, tool-use voor write-back, in-memory rate limiting.

---

## 9. PR-bundle in `prs/`

| Bestand | Beschrijving | Status |
|---|---|---|
| `001-fix-checkin-week-calculation.diff` | Centraliseer week-helpers in `src/lib/dates/week.ts`, plan-week = review-week + 7 dagen, valideer toekomst in `/api/check-in/plan`, regressie-tests | Klaar voor review |
| `002-add-ai-eval-harness.diff` | `scripts/eval-ai.ts` + 30-case JSON fixture + `pnpm eval:ai` script | Klaar voor review |
| `003-sanitize-chat-markdown-xss.diff` | `rehype-sanitize` in `ChatMessage`, XSS-payload tests | Klaar voor review |

Volgende-week PRs (niet in deze audit, wel uit te werken):
- `004-encrypt-supabase-tokens.diff` (Supabase Vault voor hevy_api_key, google refresh tokens, HAE tokens)
- `005-prompt-caching.diff` (Anthropic cache_control op statische prompt-secties)
- `006-classifier-rewrite.diff` (Haiku-classifier of tool-only routing)

---

## 10. Open vragen voor Stef (cross-cutting)

1. **Ambitie:** hobby of SaaS? De roadmap hierboven veronderstelt SaaS-launch. Als het hobby blijft: skip 5-8, doe alleen P0+P1.
2. **Vercel Pro nu of later?** Pro = €20/mo en lost cron limit + observability headroom in één keer op. Voor solo-launch: doen.
3. **Hevy-dependency:** comfortabel met de single point of failure? Plan B (Strong API / eigen logger) is een v2-vraag, niet v1.
4. **Apple Watch native app:** v1 = Siri Shortcut (1 dag werk), native = v2 (3-4 maanden).
5. **Padel als first-class sport in UI behouden?** Differentiator voor NL/ES-markt; voor internationale markt: optie.
6. **Brand-naam "Pulse"** is generiek (10+ apps in App Store). Rebrand-overweging vóór launch?

---

## 11. Direct uitvoerbare acties (max 5)

1. **Mergen `prs/003-sanitize-chat-markdown-xss.diff`** — 30 min, sluit een P0 XSS-vector. Doe het vandaag.
2. **Mergen `prs/001-fix-checkin-week-calculation.diff`** — een halve dag werk inclusief code review. Lost de bug op die Stef expliciet aankaartte.
3. **Mergen `prs/002-add-ai-eval-harness.diff` en eerste run doen** — `pnpm eval:ai` moet groen zijn voor de volgende prompt-tweak.
4. **Vandaag `pnpm add @sentry/nextjs` + initialiseer + verwijder 3 `console.log` met PHI** — observability is een 2-uurs taak die alles erna eenvoudiger maakt.
5. **Upgrade Next.js + `pnpm audit --fix`** — los de 6 HIGH CVEs op vóór elke andere refactor.

---

**Slotopmerking:** Pulse is dichter bij een betalend product dan het van binnenuit voelt. De gaten zijn concreet en behapbaar — geen herschrijving nodig. Maar productie-launchen zonder evals, zonder Sentry, zonder onboarding, en met een check-in die de verkeerde week plant, is launchen met een rugzak vol gebroken glas. Eerst die rugzak leeg, dan promoten.

— Audit afgerond, 8 fase-rapporten + 3 PR-diffs + dit master report in `.claude/audit-output/`.
