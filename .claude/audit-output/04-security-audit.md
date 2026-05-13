# Pulse Security Audit — Fase 4

**Datum:** 2026-05-13  
**Scope:** src/app/api/**, supabase/migrations/**, src/lib/supabase/**, src/lib/google/**, package.json  
**Methodologie:** OWASP Top 10 / ASVS Level 2  

---

## Executive Summary

| Severity | Aantal |
|----------|--------|
| **P0 (Critical)** | 5 |
| **P1 (High)** | 5 |
| **P2 (Medium)** | 6 |
| **P3 (Low/Info)** | 4 |

**Belangrijkste risico:** De gehele applicatie draait in "single-user mode" waarbij `createClient()` in `src/lib/supabase/server.ts` de service-role client retourneert die RLS volledig bypast. Dit is momenteel by design maar vormt een architectureel risico als de app ooit multi-user wordt. Daarnaast zijn er drie tabellen zonder RLS-policies voor normale gebruikers, een ontbrekend XSS-sanitisatie op chat-output, een admin-endpoint zonder enige authenticatie, en meerdere kritieke CVEs in Next.js 16.2.1.

---

## OWASP-stijl Findings Matrix

| ID | Categorie | Severity | Bestand:regel | Probleem | Fix |
|----|-----------|----------|---------------|----------|-----|
| SEC-01 | A01 Broken Access Control | **P0** | `src/lib/supabase/server.ts:8-21` | `createClient()` retourneert de admin/service-role client (bypast RLS volledig). Elke server-side route die `createClient()` aanroept heeft onbeperkte DB-toegang. Intentioneel voor single-user mode, maar geen enkel RLS-beleid beschermt data als de PULSE_USER_ID wordt geforged of de architectuur verandert. | Voeg een echte session-based Supabase SSR client toe naast de admin client. Gebruik admin client alleen waar expliciet nodig. |
| SEC-02 | A01 Broken Access Control | **P0** | `src/app/api/admin/seed-memory/route.ts:4-9` | Admin-endpoint zonder authenticatie. `getCurrentUserId()` leest slechts een env var — geen session-check, geen token-check. Iedereen die de URL kent kan coaching memory (her)schrijven. | Voeg een CRON_SECRET of session-check toe identiek aan andere admin/cron routes. |
| SEC-03 | A03 Injection / XSS | **P0** | `src/components/chat/ChatMessage.tsx:28-98` | `react-markdown` rendert AI-output zonder `rehype-sanitize`. Claude kan in theorie HTML bevatten (bijv. via tool-output of prompt injection). Geen `rehype-sanitize` plugin geconfigureerd, geen `allowedElements` whitelist. Als een aanvaller de AI-output kan beïnvloeden (bijv. via kwaadaardige workout-namen in Hevy die in context worden geladen), leidt dit tot stored XSS. | Voeg `rehype-sanitize` toe: `import rehypeSanitize from 'rehype-sanitize'` en `rehypePlugins={[rehypeSanitize]}` op het `<Markdown>` component. |
| SEC-04 | A06 Vulnerable Components | **P0** | `package.json:25` | Next.js 16.2.1 heeft meerdere geverifieerde CVEs: 5× HIGH (DoS via Server Components, SSRF via WebSocket, middleware/proxy bypass via dynamic route injection, middleware/proxy bypass via segment-prefetch — inclusief incomplete fix follow-up), 6× MODERATE (XSS via CSP nonces, cache poisoning, DoS Image Optimization). De middleware-bypass CVEs zijn bijzonder gevaarlijk als middleware auth-checks uitvoert. | Upgrade Next.js naar de laatste patch-versie (controleer https://nextjs.org/blog/security). |
| SEC-05 | A02 Cryptographic Failures | **P0** | `supabase/migrations/20260101000001_initial_schema.sql:20`, `20260101000010_google_calendar_tokens.sql` | `hevy_api_key`, `health_auto_export_token`, `google_calendar_access_token`, en `google_calendar_refresh_token` worden als plaintext TEXT columns opgeslagen in PostgreSQL. Als de database wordt gecompromitteerd zijn alle externe API-sleutels en OAuth-tokens direct leesbaar. Supabase Vault (pgsodium) is niet gebruikt. | Gebruik Supabase Vault (`vault.create_secret()`) voor alle externe tokens/keys. Alternatiief: encrypt op applicatieniveau vóór opslag met een KMS-key. |
| SEC-06 | A07 Identification/Auth Failures | **P1** | `src/app/api/ingest/hevy/webhook/route.ts:25-38` | Hevy webhook gebruikt Bearer token vergelijking in plaats van HMAC-signature verificatie. De Hevy API developer docs specificeren een shared secret maar geen signing algorithm. De huidige implementatie vergelijkt de volledige Authorization header letterlijk tegen `process.env.HEVY_WEBHOOK_SECRET`. Dit is functioneel maar kwetsbaar voor timing attacks (string-vergelijking is niet constant-time). | Vervang de string-vergelijking door `crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))`. |
| SEC-07 | A05 Security Misconfiguration | **P1** | `supabase/migrations/20260401000001_coaching_memory.sql:41-43` | In migratie 20260401000001 heeft de `coaching_memory` tabel een `service_role_all_memories` policy met `USING (true)` zonder `TO service_role`. Dit betekent dat de policy ook geldt voor `authenticated` en `anon` rollen — iedereen met de public anon key kan alle coaching memories van alle gebruikers lezen/schrijven/verwijderen. Migratie 20260404000002 fixt dit door de policy te droppen en opnieuw aan te maken met `TO service_role`, maar alleen als die migratie correct is uitgevoerd. | Verifieer dat migratie 20260404000002 is toegepast op productie. Voeg een controle-query toe: `SELECT policyname, roles FROM pg_policies WHERE tablename = 'coaching_memory'`. |
| SEC-08 | A01 Broken Access Control | **P1** | `supabase/migrations/20260101000011_enrich_workout_data.sql:52-57`, `85-90`, `110-115` | Tabellen `hevy_routines`, `sleep_logs`, en `body_weight_logs` hadden aanvankelijk `USING (true)` policies zonder `TO service_role` beperking (zichtbaar in migratie 11). Migratie 20260404000002 repareert dit, maar er zijn geen user-scoped SELECT policies voor `authenticated` gebruikers op `hevy_routines`, `sleep_logs`, en `body_weight_logs`. Als service_role fix niet is toegepast, kan elke geauthenticeerde gebruiker alle rijen lezen. Bovendien hebben `hevy_routines`, `sleep_logs`, `body_weight_logs`, en `coaching_memory` geen INSERT/UPDATE/DELETE policy voor authenticated users — alleen service_role. Dit is correct voor server-side writes maar kan onverwacht zijn als directe client-toegang ooit nodig is. | Voeg expliciete `TO authenticated USING (auth.uid() = user_id)` SELECT policies toe aan hevy_routines, sleep_logs, body_weight_logs als directe client-toegang gewenst is. |
| SEC-09 | A08 Software Integrity | **P1** | `src/app/api/ingest/apple-health/route.ts:541-545` | De `/api/ingest/apple-health` endpoint retourneert een `debug` object in de productie-response met interne metric namen en parse-counts. Dit lekt intern datamodel aan externe systemen. | Verwijder het `debug` object uit de productie-response of bescherm het achter een `process.env.NODE_ENV === 'development'` check. |
| SEC-10 | A09 Security Logging | **P1** | `src/app/api/ingest/hevy/webhook/route.ts:72-76` | De webhook doorloopt alle gebruikers met een Hevy API key en probeert elk te fetchen totdat de workout gevonden is. Dit is een O(n) orakel: als een aanvaller een werkend webhook-secret heeft (of dat omzeilt), kan hij via herhaalde requests achterhalen hoeveel gebruikers er zijn en welke workout-IDs bestaan. Bovendien worden Hevy API keys in de webhook-handler uitgelezen met `select('user_id, hevy_api_key')` — de keys worden in server memory geladen voor alle gebruikers tegelijk. | Implementeer directe user-lookup via webhook payload als Hevy user-context biedt, of sla een gehashte workout-prefix op bij ingest. |
| SEC-11 | A07 CSRF | **P2** | Alle POST/PUT/DELETE routes in `src/app/api/` | De applicatie gebruikt Supabase Auth cookies voor sessie-beheer. Er is geen Origin/Referer header-check op muterende routes. Next.js biedt geen ingebouwde CSRF-bescherming voor Route Handlers. SameSite cookie-attribuut is afhankelijk van Supabase SSR client configuratie (niet expliciet geconfigureerd). | Controleer dat Supabase cookies zijn ingesteld met `SameSite=Lax` minimaal (standaard bij `@supabase/ssr`). Voeg Origin-checks toe op gevoelige muterende routes, of gebruik een CSRF-token patroon. |
| SEC-12 | A02 Cryptographic Failures | **P2** | `src/lib/google/oauth.ts:7-11` | De OAuth state-signing hergebruikt `CRON_SECRET` als HMAC-key. Dit is een key-reuse probleem: als CRON_SECRET wordt gecompromitteerd, zijn zowel cron-endpoints als Google OAuth CSRF-bescherming aangetast. | Gebruik een dedicated `OAUTH_STATE_SECRET` environment variable. |
| SEC-13 | A05 Security Misconfiguration | **P2** | `src/lib/rate-limit.ts:14` | De rate limiter is in-memory (`Map`). Op Vercel kunnen meerdere function instances draaien — elke instance heeft zijn eigen bucket, wat betekent dat de effectieve rate limit `limit × aantal_instances` is. Voor de AI chat endpoint (20 req/min) is dit potentieel 20 × N per minuut zonder extra kosten-bescherming. | Gebruik `@upstash/ratelimit` met Redis voor een gedistribueerde rate limiter op AI-endpoints. |
| SEC-14 | A05 Security Misconfiguration | **P2** | `src/app/api/check-in/analyze/route.ts`, `src/app/api/check-in/plan/route.ts`, `src/app/api/check-in/review/route.ts` | AI-endpoints voor check-in (analyze, plan, review) hebben geen rate limiting. Deze endpoints roepen Anthropic API aan en kunnen significante kosten veroorzaken bij abuse. Alleen `/api/chat` en `/api/nutrition/analyze` hebben rate limiting. | Voeg `checkRateLimit()` toe aan alle AI-aanroepende endpoints. |
| SEC-15 | A04 Insecure Design | **P2** | `src/app/api/chat/route.ts:65-105` | De `extractWritebacks()` functie parst XML-tags (`<nutrition_log>`, `<injury_log>`, `<schema_generation>`, `<schema_update>`) uit Claude's tekst-output en voert DB-writes uit op basis van die inhoud. Als een aanvaller via de chat een prompt-injection kan realiseren (bijv. via kwaadaardige data in de context zoals Hevy workout-namen of coaching memory), kan hij willekeurige injury logs of training schemas inschieten. | Valideer write-back payloads strenger met Zod schemas. Voeg een user-confirmatie stap toe voor schema-generatie writes. |
| SEC-16 | A09 GDPR / Privacy | **P2** | Gehele codebase | Geen `/api/user/export` endpoint voor data-export (GDPR Art. 20). Geen `/api/user/delete` endpoint voor account-verwijdering (GDPR Art. 17). Geen cookie-banner of consent-flow zichtbaar in de codebase. Geen DPA-lijst van subprocessors (Anthropic, Hevy, Google, Vercel, Supabase). | Implementeer data-export en account-verwijdering endpoints. Documenteer subprocessors. |
| SEC-17 | A09 Security Logging | **P3** | Meerdere routes | Foutmeldingen in API responses lekken soms interne errors: `catch (error) { return NextResponse.json({ error: error.message })`. Zie bijv. `src/app/api/aggregations/compute/route.ts:87`. | Gebruik generieke foutberichten in responses, log details server-side. |
| SEC-18 | A05 Security Misconfiguration | **P3** | `src/app/api/ingest/apple-health/route.ts:155-165` | Meerdere `console.log` statements in de ingest route loggen volledige body composition data (inclusief slice van eerste 5 entries). Dit kan PII (gewicht, vetpercentage) in server logs schrijven die door Vercel worden opgeslagen. | Verwijder of vervang door geaggregeerde tellerdata zonder PII. |
| SEC-19 | A06 Vulnerable Components | **P3** | `package.json` | PostCSS heeft een MODERATE XSS CVE via ongeëscapede `</style>` tags in CSS stringify output (path: `.>@tailwindcss/postcss>postcss`). Dit is een build-time tool, niet runtime, maar kan bij CI/CD-aanvallen relevant zijn. | Update via `pnpm update postcss`. |
| SEC-20 | A05 Security Misconfiguration | **P3** | `src/lib/supabase/client.ts` (ontbreekt in overzicht) | De `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY` zijn noodzakelijkerwijs publiek. Zeker stellen dat de anon key alleen leestoegang heeft tot public data (exercise_definitions) en niet tot user data — dit is afhankelijk van correcte RLS-configuratie. | Auditeer via Supabase dashboard: Test met anon key of user data bereikbaar is zonder session. |

---

## RLS Coverage Tabel

| Tabel | RLS enabled | SELECT policy | INSERT policy | UPDATE policy | DELETE policy | Status |
|-------|-------------|---------------|---------------|---------------|---------------|--------|
| profiles | Ja | FOR ALL auth.uid()=id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| user_settings | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| exercise_definitions | Ja | USING(true) — public read | — | — | — | Acceptabel (reference tabel) |
| workouts | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| workout_exercises | Ja | Via workout ownership JOIN | Via JOIN | Via JOIN | Via JOIN | Goed |
| workout_sets | Ja | Via workout ownership JOIN | Via JOIN | Via JOIN | Via JOIN | Goed |
| runs | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| padel_sessions | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| daily_activity | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| nutrition_logs | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| daily_nutrition_summary | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| chat_sessions | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| chat_messages | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| injury_logs | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| training_schemas | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| schema_block_summaries | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| goals | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| personal_records | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| daily_aggregations | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| weekly_aggregations | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| monthly_aggregations | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| coaching_memory | Ja | SELECT: auth.uid()=user_id | TO service_role USING(true)* | TO service_role USING(true)* | TO service_role USING(true)* | Risico: zie SEC-07 |
| weekly_reviews | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |
| hevy_routines | Ja | SELECT: auth.uid()=user_id | TO service_role* | TO service_role* | TO service_role* | Risico: zie SEC-08 |
| sleep_logs | Ja | SELECT: auth.uid()=user_id | TO service_role* | TO service_role* | TO service_role* | Risico: zie SEC-08 |
| body_weight_logs | Ja | SELECT: auth.uid()=user_id | TO service_role* | TO service_role* | TO service_role* | Risico: zie SEC-08 |
| body_composition_logs | Ja | FOR ALL auth.uid()=user_id | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | FOR ALL (WITH CHECK) | Goed |

*Mits migratie 20260404000002 correct is toegepast.

---

## API Routes × Auth-check Tabel

| Route | Methode | Auth check | user_id bron | Zod input validatie | Rate limiting | Status |
|-------|---------|------------|--------------|---------------------|---------------|--------|
| /api/activities | GET | createClient + getUser | token | Nee (query params) | Nee | P2 |
| /api/admin/seed-memory | POST | **GEEN** — alleen env var | env var | Nee | Nee | **P0** |
| /api/aggregations/compute | POST | createClient + getUser | token | Ja | Nee | OK |
| /api/ai-context-preview | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/body-composition | GET/POST | createClient + getUser | token | GET: nee, POST: ja | Nee | P2 |
| /api/calendar/auth | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/calendar/callback | GET | HMAC state verificatie | HMAC state | N/A | Nee | OK |
| /api/calendar/disconnect | POST | createClient + getUser | token | Nee | Nee | P2 |
| /api/calendar/events | GET/POST | createClient + getUser | token | POST: ja | Nee | OK |
| /api/chat | POST | createClient + getUser | token | Ja (Zod) | Ja (20/min) | OK |
| /api/chat/history | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/check-in/analyze | POST | createClient + getUser | token | Ja | Nee | P2 (geen rate limit) |
| /api/check-in/confirm | POST | createClient + getUser | token | Ja | Nee | P2 (geen rate limit) |
| /api/check-in/history | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/check-in/plan | POST | createClient + getUser | token | Ja | Nee | P2 (geen rate limit) |
| /api/check-in/plan/conflicts | POST | createClient + getUser | token | Ja | Nee | OK |
| /api/check-in/review | POST | createClient + getUser | token | Ja | Nee | P2 (geen rate limit) |
| /api/check-in/status | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/coaching-memory | GET/PUT/DELETE | createClient + getUser | token | PUT/DELETE: ja | Nee | OK |
| /api/cron/daily-aggregate | GET | CRON_SECRET header | N/A | N/A | N/A | OK |
| /api/cron/hevy-sync | GET | CRON_SECRET header | N/A | N/A | N/A | OK |
| /api/cron/weekly-aggregate | GET | CRON_SECRET header | N/A | N/A | N/A | OK |
| /api/dashboard | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/goals | GET/POST | createClient + getUser | token | POST: ja | Nee | OK |
| /api/goals/[id] | GET/PATCH/DELETE | createClient + getUser | token | PATCH: ja | Nee | OK |
| /api/health/today | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/ingest/apple-health | POST | Bearer token vs DB/env | DB lookup | Ja (Zod parseHealthPayload) | Nee | OK* |
| /api/ingest/hevy/sync | POST | createClient + getUser | token | N/A | Nee | OK |
| /api/ingest/hevy/webhook | POST | Bearer token vs env var | env var | Ja (Zod) | Nee | P1 (timing attack) |
| /api/muscle-map | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/nutrition/analyze | POST | createClient + getUser | token | Ja | Ja (30/min) | OK |
| /api/nutrition/summary | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/progress | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/progress/exercise | GET | createClient + getUser | token | Nee (query params) | Nee | P2 |
| /api/progress/exercises | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/readiness | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/schema | GET/POST/PATCH | createClient + getUser | token | POST/PATCH: ja | Nee | OK |
| /api/schema/overrides | POST/DELETE | createClient + getUser | token | Ja | Nee | OK |
| /api/schema/reschedule | POST | createClient + getUser | token | Ja | Nee | OK |
| /api/schema/week | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/settings | GET/PATCH | createClient + getUser | token | PATCH: ja | Nee | OK |
| /api/trends | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/workload | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/workouts | GET | createClient + getUser | token | N/A | Nee | OK |
| /api/workouts/[id] | GET | createClient + getUser | token | N/A | Nee | OK |

*Apple Health ingest is functioneel correct maar heeft geen rate limiting op de Bearer token route — een aanvaller met een geldig token kan de endpoint spammen en grote hoeveelheden data ingesten.

---

## Dependency Audit Samenvatting

**Tool:** `pnpm audit` op 2026-05-13

| Severity | Package | CVE-beschrijving |
|----------|---------|------------------|
| HIGH | next@16.2.1 | DoS via Server Components (meerdere CVEs) |
| HIGH | next@16.2.1 | SSRF via WebSocket upgrades |
| HIGH | next@16.2.1 | Middleware/proxy bypass via dynamic route parameter injection |
| HIGH | next@16.2.1 | Middleware/proxy bypass via segment-prefetch routes (+ incomplete fix follow-up) |
| HIGH | next@16.2.1 | DoS via Cache Components / connection exhaustion |
| MODERATE | next@16.2.1 | XSS via CSP nonces in beforeInteractive scripts |
| MODERATE | next@16.2.1 | Cache poisoning in RSC responses |
| MODERATE | next@16.2.1 | Cache poisoning via React Server Component cache-busting |
| MODERATE | next@16.2.1 | DoS in Image Optimization API |
| MODERATE | postcss@8.x | XSS via unescaped `</style>` in CSS stringify (build-time) |

De middleware-bypass CVEs (dynamic route parameter injection + segment-prefetch) zijn het meest kritiek als auth middleware wordt gebruikt. Controleer `/middleware.ts` op auth-logica die bypass kan worden omzeild.

---

## Architeturele Noot: Single-user Mode

De keuze om `createClient()` te laten proxyen naar `createAdminClient()` met een gesimuleerde `getUser()` is begrijpelijk voor single-user mode, maar heeft drie risico's:

1. **RLS is zinloos**: Alle RLS-policies die met `auth.uid()` werken hebben geen effect omdat de service role ze bypast. Dit is nu niet schadelijk (single-user), maar betekent dat RLS-policies niet getest worden en bij een multi-user upgrade direct gaten heeft.
2. **user_id is niet geverifieerd**: De `user.id` die uit `getUser()` komt is de hardcoded PULSE_USER_ID env var. Als die env var ooit onterecht wordt ingesteld of gelekt, is er geen tweede verificatielaag.
3. **Audit trail ontbreekt**: Service-role queries worden niet gelogd als gebruikersacties in Supabase Auth audit logs.

---

## Direct Uitvoerbare Acties (Top 5)

1. **SEC-03 — XSS fix (30 minuten):** Installeer `rehype-sanitize` (`pnpm add rehype-sanitize`) en voeg het toe aan `ChatMessage.tsx`. Dit is de snelste P0-fix met het hoogste risico.

2. **SEC-02 — Admin endpoint beveiligen (15 minuten):** Voeg een `CRON_SECRET` Bearer token check toe aan `/api/admin/seed-memory/route.ts`, identiek aan de cron-routes.

3. **SEC-04 — Next.js updaten:** Voer `pnpm update next` uit naar de meest recente patched versie. Controleer `/middleware.ts` na de upgrade op gedragswijzigingen door de middleware-bypass fixes.

4. **SEC-07/08 — RLS migration verificatie:** Voer in Supabase SQL editor uit: `SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE tablename IN ('coaching_memory', 'hevy_routines', 'sleep_logs', 'body_weight_logs');` en bevestig dat alle policies `TO {service_role}` bevatten.

5. **SEC-14 — Rate limiting op AI check-in routes (1 uur):** Voeg `checkRateLimit()` toe aan `/api/check-in/analyze`, `/api/check-in/plan`, en `/api/check-in/review` om ongecontroleerde Anthropic API-kosten te voorkomen.

---

## Open Vragen voor Stef

1. **Multi-user toekomst:** Is Pulse uitsluitend single-user (persoonlijk dashboard voor jou), of is er een plan om het beschikbaar te stellen voor andere gebruikers? Dit bepaalt de urgentie van het herstellen van de single-user mode architectuur (SEC-01).

2. **Supabase Vault beschikbaar?** Supabase Vault (pgsodium) is beschikbaar op de Pro plan. Ben je bereid Hevy API keys en Google OAuth tokens encrypted op te slaan? Dit vereist schema-migraties en library-aanpassingen.

3. **Hevy webhook signing:** Hevy's documentatie is onduidelijk over of ze HMAC-signing ondersteunen naast Bearer tokens. Heb je toegang tot de Hevy Developer Settings om te zien welke opties er zijn voor webhook authentication?

4. **GDPR-scope:** Is Pulse een persoonlijk tool (geen GDPR-verplichting als je enige gebruiker bent) of plan je het open te stellen voor anderen? Dit bepaalt of SEC-16 urgent is.

5. **`/middleware.ts` — bestaat dit bestand?** De Next.js middleware-bypass CVEs zijn alleen gevaarlijk als er een `middleware.ts` is met auth-logica. Dit bestand was niet zichtbaar in de audit scope — verifieer of het bestaat en wat het doet.

