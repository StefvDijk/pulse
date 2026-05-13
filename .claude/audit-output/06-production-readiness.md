# Fase 6 — Productie-gereedheid voor 100+ klanten

**Scope:** Pulse (Next.js 16 + Supabase + Anthropic Claude API + Vercel)
**Vraag:** Kan Pulse vandaag betalend live met 100+ externe klanten?
**Korte conclusie:** **Nee.** Pulse is technisch een single-user MVP met multi-user RLS-fundering. Ontbreekt op zes essentiële assen: billing, e-mail, observability, GDPR-flows, onboarding, en legal. Met de huidige opzet zijn er 4-8 weken werk nodig voor een eerste paid-beta, en realistisch 10-12 weken voor 100+ betalende klanten.

---

## 1. Infra & runtime-limieten

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| Vercel cron jobs (3) | ✅ | `vercel.json` — 3 crons: `hevy-sync`, `daily-aggregate`, `weekly-aggregate` | Hobby-tier limiet is 2 cron jobs → **Pulse vereist Pro ($20/mo) of hoger**. Helder. |
| Cron uitvoeringstijd | ⚠️ | `src/app/api/cron/hevy-sync/route.ts:46` itereert sync **sequentieel per user** binnen één request | Hobby/Pro fluid-compute timeout = 60s, met `maxDuration` config max 300s op Pro. Bij 100 users × ~1-3s/sync = **3-5 minuten** → cron job verloopt. Vereist queueing (Vercel Queues / Supabase pg_cron / Inngest). |
| Vercel function memory & invocations | ⚠️ | Geen `runtime` of `maxDuration` config in API routes | Default 1024MB / 10s timeout (Hobby). AI chat streaming kan tegen limiet aan op Hobby. Verifieer en zet `export const maxDuration = 60` waar nodig op Pro. |
| Vercel bandbreedte | ⚠️ | Pro = 1TB/mo include | Dashboard fetcht via SWR met `refreshInterval: 60s` (per `CLAUDE.md`); bij 100 actieve users = ruwweg 4-6M API hits/mo. Doable, maar monitor. |
| Supabase Free tier | ❌ | `package.json` toont `@supabase/supabase-js`; geen tier-config aanwezig | Free = 500MB DB, 50K MAU, **paused na 1 week inactiviteit**. Met 100 users (workouts, body comp, nutrition, chat history, aggregaties) is 500MB binnen 1-3 maanden vol. **Vereist Pro ($25/mo) of hoger** vóór paid launch. |
| Supabase DB-grootte stress-grens | ⚠️ | `migrations/*.sql` — `workout_sets`, `chat_messages`, `daily_aggregations`, `apple_health_*` zijn high-volume tabellen | Ruwe inschatting: ~50-150 MB/user/jaar. **500MB = ~10 actieve users maximaal** op Free. Pro Small (8GB) = ~50-150 users; Pro Medium (256GB) ruim voldoende voor 1000+. |
| Supabase Edge Functions | – | Niet in gebruik (alles Next.js routes) | OK voor schaal — geen extra vendor lock-in. |
| Anthropic API quota | ⚠️ | `src/lib/ai/` — chat streaming via `@ai-sdk/anthropic` | Sonnet kost ~$0.003-$0.015/chat afhankelijk van context. 100 users × 5 chats/wk = ~$15-50/wk. Geen per-user rate-limiting → één power-user kan budget opblazen. |
| Hevy API rate-limit | ⚠️ | `src/lib/hevy/sync.ts` | Hevy publieke API = niet officieel; tier-vereisten zijn Hevy Pro per user (€5/mo). Geen aanmaak van een centrale Pulse-app key (zou breken bij velen). |

**Verdict infra:** Vercel Pro + Supabase Pro **verplicht** voor day-1. Cron-architectuur moet richting **fan-out queue** voor 100+ users (één cron triggert N parallelle workers).

---

## 2. Multi-tenancy

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| RLS enabled op alle user-tabellen | ✅ | `migrations/20260101000008_rls_policies.sql:6-26` toont `ALTER TABLE … ENABLE ROW LEVEL SECURITY` op 23 tabellen | Goed fundament. |
| RLS-policies user-scoped | ✅ | `policies.sql` — `USING (auth.uid() = user_id)` op alle privé-tabellen; `exercise_definitions` is shared (read-only) | Klopt. |
| Service-role client gebruik | ⚠️ | `src/app/api/settings/route.ts:57` gebruikt `createAdminClient()` na auth-check; idem in tientallen routes | **Pattern is veilig** zolang auth-check vóór elke admin-query staat. Risico: bij elke nieuwe route moet de developer dit handmatig herhalen. Eén vergeten `eq('user_id', user.id)` = data-lek. Aanbeveling: introduceer een `withAuthedUser` helper of gebruik cookie-aware client met JWT-propagatie naar PostgREST. |
| Hevy API-key per user | ✅ | `src/lib/hevy/sync.ts` — `process.env.HEVY_API_KEY ?? user_settings.hevy_api_key` | BYOK supported. Echter — env-fallback betekent **leakage-risico in multi-tenant**: als `HEVY_API_KEY` per ongeluk in Vercel env staat, valt elke user-sync terug op die key. **Verwijder env-fallback** voor productie. |
| HAE token per user | ✅ | `src/app/api/ingest/apple-health/route.ts` — per-user token in `user_settings.health_auto_export_token` | Goed gemodelleerd. |
| Android-strategie | ❌ | HAE is iOS-only; geen Google Fit / Health Connect ingest pad | **Blocker voor 100+ users**: ~30-50% van NL-fitness-publiek gebruikt Android. Geen ingest = halve TAM. Roadmap-item. |
| Cross-user leakage tests | ❌ | Geen E2E test in `tests/` die controleert dat user A geen data van user B kan zien | Verplicht voor productie — schrijf Playwright suite per kritisch endpoint. |
| Per-user usage quota | ❌ | Geen rate-limiting per user op AI-chat, ingest, of Hevy-sync | Vereist voor kostencontrole. Voeg Upstash/Vercel KV-based rate limit toe. |

**Verdict multi-tenancy:** RLS fundering is gezond, maar zonder explicit `withAuthedUser` wrapper, automatische tests, en rate limits is dit fragiel. Audit elke nieuwe route bij elk PR.

---

## 3. Onboarding (signup → werkende app)

| Stap | Status | Evidence | Aanbeveling |
|---|---|---|---|
| Email + wachtwoord signup | ✅ | `src/app/auth/signup/page.tsx:21` `supabase.auth.signUp` | Functioneel. |
| Email verification | ❌ | Geen `emailRedirectTo` flow, geen check op `email_confirmed_at` vóór login | Supabase heeft dit default aan, maar zonder mail-template & SMTP-config faalt het stilletjes. **Configureer custom SMTP** (Resend/Postmark) en check `email_confirmed_at` server-side. |
| Profiel-init (display_name, weight, height) | ⚠️ | Signup slaat alleen `display_name` op via `options.data`; weight/height/dietary opgeven gebeurt achteraf in Settings | Geen guided onboarding-flow. Nieuwe user landt op homescreen zonder data → lege staat. Voeg wizard toe (3 stappen: profile → integrations → first goal). |
| Exercise seed per user | ✅ | `exercise_definitions` is global (geen `user_id`), `migrations/20260101000001_initial_schema.sql:32` + `seed-exercises.ts` | Eenmalig seeden, alle users delen referentie. Goed. |
| User-settings row auto-create | ⚠️ | Geen trigger gevonden die `user_settings` row aanmaakt bij signup | Bij eerste request faalt `.single()` op `user_settings`. **Verifieer** en voeg `on_auth_user_created` trigger toe (`INSERT INTO user_settings(user_id) VALUES (NEW.id)`). |
| Integraties (Hevy, HAE, Google Cal) | ⚠️ | Settings-pagina, copy beschikbaar; geen "verify connection" knop / health-check | Onboarding zonder feedback dat sync werkt = frustratie. Voeg test-knop toe. |
| Eerste-data ervaring | ❌ | Homescreen zonder data toont raw zeros (zie Fase 5 audit) | Stef's eigen rule: "never ship pages with raw/meaningless data". Lege staten ontwerpen. |

---

## 4. Billing

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| Stripe integratie | ❌ | `grep stripe package.json src/` = leeg | **Hard blocker** voor paid launch. |
| Subscription-model gedefinieerd | ❌ | Geen `plans`, `subscriptions`, `entitlements` tabel in migraties | Beslis: free + paid? trial? jaarlijks? Begin bij PRD. |
| Pricing tiers | ❌ | Niet in code, niet in PRD | Suggestie: €8-12/mo (BYOK Hevy + AI included), of free tier zonder AI. |
| Trial / free quota | ❌ | – | Stripe Checkout met 14-dagen trial is standaard. |
| Usage-based AI cap | ❌ | Geen meter op Anthropic-tokens per user | Power-user kan €50/mo aan Claude verbranden. Cap of meter. |
| Failed-payment flow | ❌ | – | Stripe Customer Portal + webhook → mark `subscription_status` op user. |

**Verdict billing:** Helemaal niet aanwezig. Realistische lift = 1-2 weken voor Stripe Checkout + webhook + portal + UI.

---

## 5. Email

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| Transactional provider | ❌ | Geen Resend/Postmark/SES/SendGrid dependency in `package.json` | Supabase Auth default SMTP is rate-limited (3 mails/uur) en niet geschikt voor productie. **Configureer custom SMTP** (Resend gratis tot 3K/mo). |
| Account verification mail | ❌ | Niet getest, niet aangepast | Supabase template gebruikt; templates aanpassen in Supabase Studio + custom branding. |
| Wachtwoord-reset | ❌ | Geen `/auth/reset-password` route in `src/app/auth/` | **Hard blocker** — users die hun wachtwoord vergeten zijn vast. Implementeer reset-flow. |
| Weekly digest | ❌ | – | Nice-to-have voor retention. Cron job die wekelijks samenvatting mailt. |
| Engagement/lifecycle mails | ❌ | – | Resend + cron + AI-gegenereerde nudge. |

---

## 6. Observability

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| Sentry / error tracking | ❌ | Geen `@sentry/nextjs` in `package.json`; geen `src/instrumentation.ts` | **Verplicht** voor productie. Sentry free tier = 5K events/mo, ruim voor 100 users. |
| Structured logging | ❌ | 111 `console.log/error` calls in `src/` (grep count) | Geen niveau-logging, geen request-correlation. Adopteer pino of `next-logger`; pipe naar Axiom of Logflare. |
| Vercel Analytics | ❌ | Geen `@vercel/analytics` dep | Gratis op Vercel; voeg toe voor pageviews. |
| Speed Insights / Web Vitals | ❌ | – | Gratis op Vercel; nuttig. |
| Uptime monitoring | ❌ | – | BetterStack / Uptime Robot pingen `/api/health` (route bestaat in `src/app/api/health/`). |
| AI cost monitoring | ❌ | Geen logging van token-gebruik per user | Voeg `ai_usage` tabel toe; log `input_tokens`, `output_tokens`, `cost_eur` per request. |
| Database performance | ⚠️ | Supabase dashboard biedt slow-query log op Pro; geen pg_stat_statements check in audit | Schakel in op Pro. |

---

## 7. Data-lifecycle (GDPR / Privacy)

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| PITR (point-in-time recovery) | ❌ | Niet in Free-tier; Supabase Pro = 7 dagen PITR | **Verplicht** voor health-data ($25/mo Pro is genoeg, Team-tier voor langer venster). |
| Automated backups | ⚠️ | Supabase Pro = daily backup 7d retention | OK voor start. |
| GDPR data-export endpoint | ❌ | `grep export src/app/api/` toont alleen interface-exports, geen `/api/account/export` | **AVG art. 20** vereist data portability. Bouw endpoint dat alle user-data als JSON/ZIP teruggeeft. |
| GDPR delete-account endpoint | ❌ | Geen `DELETE /api/account` of admin-UI | **AVG art. 17** ("recht op vergetelheid") = hard legal requirement. `ON DELETE CASCADE` is correct geconfigureerd op `profiles(id)` (zie `migrations/…001_initial_schema.sql:19`), maar er is geen user-facing flow. |
| Cookie consent | ❌ | Geen banner of consent-state | Voor analytics + EU verplicht (al heeft Pulse nu geen tracking). Bij toevoegen Posthog/GA verplicht. |
| Data retention policy | ❌ | – | Definieer: chat history bewaard X maanden, na delete account = 30d soft-delete? |
| Data Processing Agreement (DPA) | ❌ | Geen DPA met Supabase/Anthropic/Vercel ondertekend (waarschijnlijk) | Supabase: DPA via dashboard. Anthropic: DPA op aanvraag. Vercel: DPA in Pro+. |
| Sub-processor disclosure | ❌ | – | Aparte pagina op website. |
| Health-data classificatie | ⚠️ | Pulse verwerkt gewicht, hartslag, body-composition = **bijzondere persoonsgegevens (AVG art. 9)** | Vereist hoger consent-niveau + DPIA. Juridisch advies aanbevolen vóór paid launch in NL/EU. |

---

## 8. Legal

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| Privacyverklaring | ❌ | Geen `/privacy` route in `src/app/` | Verplicht. Termly/Iubenda genereren NL-AVG-compliante versie (€10/mo). |
| Algemene voorwaarden | ❌ | Geen `/terms` route | Verplicht voor betaalde dienst. |
| Cookie policy | ❌ | – | Verplicht zodra analytics live. |
| Disclaimer (niet-medisch advies) | ❌ | – | **Kritisch**: AI-coach geeft trainings/voeding-advies. Disclaimer "geen medisch advies, raadpleeg arts" verplicht in footer en chat-UI. |
| KvK/BTW-vermelding | ❌ | – | Vereist voor NL e-commerce. |

---

## 9. Support

| Item | Status | Evidence | Aanbeveling |
|---|---|---|---|
| Helpdesk / contact-form | ❌ | Geen route/component gevonden | Min: mailto in footer. Plus: in-app feedback-widget (`@feedbackfin/sdk` of Plain.com). |
| FAQ / docs | ⚠️ | `docs/` aanwezig (intern); geen public docs-site | Notion-public of Mintlify voor user docs. |
| In-app bug-report | ❌ | – | Knop in Settings → mail-template. |
| Status-page | ❌ | – | Gratis op BetterStack. |

---

## Go/no-go voor 100+ users

**Verdict: NO-GO** in huidige staat. Onderstaande items zijn **harde blockers** vóór paid launch:

1. **Billing (Stripe)** — geen revenue collection mogelijk.
2. **Wachtwoord-reset flow** — operationeel onmisbaar.
3. **Custom SMTP + email-verification** — Supabase default rate-limited.
4. **GDPR delete + export endpoints** — wettelijk verplicht (AVG art. 17 + 20).
5. **Privacyverklaring + ToS + medische disclaimer** — wettelijk verplicht voor betaalde gezondheids-app in EU.
6. **Sentry + structured logging** — productie zonder error-tracking is roulette.
7. **Supabase Pro + Vercel Pro** — Free-tiers zijn ontoereikend voor 100 users (500MB DB, 2 crons).
8. **Cron fan-out architectuur** — sequentiële sync schaalt niet > ~30 users binnen 60s timeout.
9. **Rate-limiting per user op AI-chat** — kostenrisico.
10. **Onboarding wizard + lege-staat-UX** — anders is churn op dag 1 desastreus.

Tegelijk **goed gedaan** en geen blockers:
- RLS-policies dekken alle user-tabellen.
- BYOK-model voor Hevy is correct geïmplementeerd.
- Per-user HAE-token model is goed.
- Security headers in `next.config.ts` zijn aanwezig.
- Cron-secret-verificatie aanwezig.
- ON DELETE CASCADE op `profiles` zorgt voor schone account-delete.

---

## Roadmap-suggestie

### Sprint 1 (Week 1-4) — Foundation voor paid beta (≤25 users)
- Vercel Pro + Supabase Pro upgrade + PITR aan.
- Sentry + Axiom-logging + Vercel Analytics.
- Custom SMTP (Resend) + password-reset flow + email-verification check.
- `/privacy`, `/terms`, medische disclaimer footer.
- GDPR export + delete endpoints (server-side).
- Trigger `on_auth_user_created` voor `user_settings`-row.
- Per-user rate-limiting op AI-chat + sync endpoints (Upstash).
- Verwijder `HEVY_API_KEY` env-fallback voor multi-tenant veiligheid.

### Sprint 2 (Week 5-8) — Monetization & onboarding (≤50 users)
- Stripe Checkout + Customer Portal + subscription-webhook.
- `subscriptions` + `entitlements` tabellen + RLS.
- Onboarding wizard (3 stappen) + lege-staat-UI per dashboard-kaart.
- Cron fan-out: hevy-sync wordt orchestrator die per user een Vercel Queue / Inngest job aftrapt.
- `ai_usage` logging + per-user maand-cap met soft-limit-melding.
- In-app feedback widget + status-page.
- DPA met Supabase + Anthropic + Vercel ondertekenen.

### Sprint 3 (Week 9-12) — Scaling tot 100+ users
- Android-strategie: Google Fit / Health Connect ingest endpoint.
- Weekly digest email (cron + Resend + template).
- Cross-user leakage E2E test suite (Playwright per RLS-tabel).
- Database performance audit + indexen op high-volume queries.
- DPIA opstellen (bijzondere persoonsgegevens vereist dit boven 50 users in praktijk).
- KvK + BTW-administratie + boekhoudkoppeling.
- Public docs-site + 5-10 FAQ-pagina's.

---

## Direct uitvoerbare acties (deze week)

1. **Sentry aanzetten** — `pnpm add @sentry/nextjs && npx @sentry/wizard@latest -i nextjs`. Free tier dekt eerste 100 users ruim. 1 uur werk.
2. **Schrijf privacy + ToS placeholder pages** (`src/app/privacy/page.tsx`, `src/app/terms/page.tsx`) — gebruik Termly/Iubenda generator. Footer-link toevoegen. Halve dag.
3. **Implementeer password-reset** — Supabase docs hebben kant-en-klaar voorbeeld; voeg `/auth/reset-password` route toe. 2 uur.
4. **Maak GDPR-export endpoint** — `GET /api/account/export` die alle user-tabellen joined en als ZIP teruggeeft. 1 dag.
5. **Verwijder `HEVY_API_KEY` env-fallback uit `src/lib/hevy/sync.ts`** en log expliciet als user geen key heeft. 30 minuten.

---

## Open vragen voor Stef

1. **Pricing-model**: wil je free tier + paid (freemium) of paid-only met trial? Heeft impact op AI-kosten-strategie (BYOK voor Anthropic of include?).
2. **Doel paid launch-datum**: half jaar weg of binnen 2 maanden? Bepaalt sprint-prioriteit (cron fan-out kan wachten als ≤25 users).
3. **Android-roadmap**: accepteren we iOS-only launch (Apple Health required) of moet Google Fit/Health Connect day-1 mee?
4. **Doelgroep & jurisdictie**: alleen NL/EU, of ook UK/US? Bepaalt legal-vereisten (UK-GDPR, CCPA).
5. **AI-coach disclaimer-positie**: alleen footer, of ook elke chat-response een banner? Hangt af van juridisch advies + claim-zwaarte.
6. **Data-retention beleid**: hoe lang bewaren we chat-history en gezondheidsdata na account-delete? 0 dagen (immediate hard-delete) of 30d soft-delete?
7. **Support-SLA**: beloofd response-tijd voor betalende klanten? Bepaalt of mailto: volstaat of dat je een ticketing-tool nodig hebt.
8. **Hevy ToS compliance**: heb je gecontroleerd of Hevy publieke API commercieel gebruik toelaat als Pulse betaald wordt? Hun ToS is ambiguous over white-label-doorverkoop.
9. **Anthropic enterprise/PAYG**: blijft API-key in jouw account en factureer je users, of BYOK voor Claude key (privacyer maar lastiger UX)?
10. **Backup-test**: heb je ooit een PITR-restore daadwerkelijk getest, of is dit theoretisch?

---

*Audit-fase 6 afgerond — 2026-05-13. Geen code-wijzigingen gemaakt; alle bevindingen evidence-based uit codebase op `main` (commit bcc8b73).*
