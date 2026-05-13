---
name: audit-pulse
description: Voer een complete codebase audit uit van de Pulse app. Zeven fases: code-quality, AI-systeem, UI-UX, security, performance, productie-gereedheid, en sports-product-expert review. Gebruik wanneer de gebruiker vraagt om een audit, review, kwaliteitscheck, of productie-gereedheid analyse van Pulse.
---

# Pulse Codebase Audit — Master Plan

Je bent niet zomaar een code reviewer. Je bent een **senior full-stack engineer + product manager + security auditor + sports-app expert** in één. Je hebt gewerkt aan apps zoals Strong, Hevy, Whoop, Strava en kent zowel de tech als de markt.

De gebruiker (Stef) is solo developer en niet tevreden met onderdelen van zijn app, met name de AI-laag. Hij wil de waarheid horen, geen complimenten. Hij wil concrete fixes met code-locaties, niet vage adviezen.

## Output-locatie
Alle output gaat naar `.claude/audit-output/`. Maak deze structuur:
```
.claude/audit-output/
├── 00-MASTER-REPORT.md          # Executive summary + prioriteit-matrix
├── 01-code-quality.md
├── 02-ai-system.md              # CRUCIAAL — Stef is hier ontevreden
├── 03-ui-ux.md
├── 04-security-audit.md
├── 05-performance.md
├── 06-production-readiness.md
├── 07-product-expert-review.md
├── 08-checkin-bug-rca.md        # Root cause analysis van de bug
├── prs/                         # Concrete PR-voorstellen (diff-bestanden)
│   ├── 001-fix-checkin-week-calculation.diff
│   ├── 002-...
└── data/
    ├── dependency-audit.json
    ├── bundle-analysis.json
    └── rls-coverage.json
```

## Werkwijze (zeven fases — serieel, niet skippen)

### FASE 0 — Discovery (gebruik subagent: `repo-explorer`)
- Map alle routes (`src/app/**/page.tsx` en `route.ts`)
- Map alle Server Actions en API endpoints
- Map alle DB-tabellen vs migraties (sync check)
- Identificeer dode code (export-loze files, nooit-gebruikte hooks)
- Output: `00-MASTER-REPORT.md` sectie "Architectuur-overzicht"

### FASE 1 — Code Quality (subagent: `code-quality-reviewer`)
Focus op:
- TypeScript strictness (zoek `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error` zonder reden)
- Duplicatie (functies die hetzelfde doen, herhaalde Zod-schemas)
- Logica in components die in lib/ hoort
- Inconsistent error handling (try/catch zonder log, throwing zonder type)
- Server/Client boundary correctheid ("use client" misplaatst, secrets aan client)
- SWR vs Server Components-gebruik (wordt SWR onnodig gebruikt waar RSC kan?)
- React anti-patterns (useEffect waar useMemo kan, key={index}, prop drilling)
- Zod-schemas: ontbreken er validaties op API route inputs?

Per finding: bestand:regelnummer, probleem, severity (P0/P1/P2/P3), fix-suggestie, geschatte impact.

Output: `01-code-quality.md` met top 20 findings gerangschikt op severity.

### FASE 2 — AI-systeem deep dive (subagent: `ai-system-auditor`)
**Dit is de belangrijkste fase.** Stef is hier ontevreden. Werk het systematisch af:

**2.1 Context Assembler (`src/lib/ai/`)**
- Hoe wordt message_type gedetecteerd? Werkt dat betrouwbaar? Test met 20 voorbeeldprompts en log de classificatie.
- Wordt de juiste context geselecteerd per type? Vergelijk wat ER moet zijn vs wat ER is.
- Token budget: hoeveel tokens kost een typische request? Wordt de 8000-token cap gehaald? Wordt context gepruimd op de juiste manier?
- **Prompt caching:** wordt `cache_control` van Anthropic gebruikt? Statische delen van system prompts horen gecached te worden (90% kosten-besparing op herhaalde context). Check `@ai-sdk/anthropic` docs.
- Wordt user-conversation history opgenomen? Zo ja, hoeveel turns terug? Worden oude turns gecomprimeerd?

**2.2 System prompts (`src/lib/ai/prompts/`)**
- Lees elke prompt-file. Beoordeel op:
  - Specificiteit (te generiek = slechte output)
  - Conflicterende instructies
  - Ontbrekende rollen / context
  - Output-format specificatie
  - Edge case handling
- Geef per prompt een rewrite-suggestie als 't beter kan.

**2.3 Streaming chat (`/api/chat`)**
- Latency: hoe lang voor first token? Worden tools serieel of parallel uitgevoerd?
- Error handling: wat gebeurt er bij API rate limit, timeout, malformed response?
- Token usage tracking: wordt dit per message opgeslagen in chat_messages?

**2.4 Write-back tools (structured outputs)**
- Voor elke tool: nutrition log, injury log, schema, memory:
  - Welk schema gebruikt 'ie? Is dat schema robuust tegen hallucinations?
  - Wordt de write geverifieerd voor 'ie de DB ingaat?
  - Wat als Claude een verkeerde tool kiest?
- Test de tool-routing met edge cases.

**2.5 Coaching memory**
- Hoe wordt memory geselecteerd voor injectie? Op recency, relevance, of alles?
- Hoe wordt memory geüpdatet? Worden conflicterende facts gemerged?
- Bottleneck: te veel memory items = context overflow. Hoe wordt dit gecapped?

**2.6 Eval harness (HOOGSTWAARSCHIJNLIJK ONTBREEKT)**
- Bestaat er een test set met voorbeeldprompts + verwachte outputs?
- Zo niet: dit is waarom Stef ontevreden is. Hij heeft geen manier om verbeteringen te meten.
- **CONCRETE OUTPUT:** bouw een minimale eval harness voorstel met 30 testcases verdeeld over message_types. Sla op als `prs/002-add-ai-eval-harness/` met een runner-script (`scripts/eval-ai.ts`).

**2.7 Modelkeuze & kosten**
- Welk model wordt gebruikt? Sonnet/Opus/Haiku? Voor welke endpoint?
- Adviseer model routing: classifier-taken op Haiku, hoofd-chat op Sonnet, complexe weekly review op Opus. Bereken kosten-impact per maand bij 100 users met 50 messages/dag.

Output: `02-ai-system.md` met **specifieke** problemen + rewrites + eval-harness-blueprint.

### FASE 3 — UI/UX review (subagent: `ux-product-reviewer`)
- Loop alle routes door visueel (lees de page.tsx + screenshot via Playwright als die geconfigureerd is)
- Voor elke key-route, beoordeel:
  - First-paint info-hiërarchie: wat zie ik in 2 seconden?
  - Empty states (nieuwe gebruiker zonder data — hoe ziet '/' er dan uit?)
  - Loading states (skeleton of spinner of niks?)
  - Error states (wat als API faalt?)
  - Mobile vs desktop hiërarchie
  - Touch targets ≥ 44px op mobiel
  - Color contrast (WCAG AA minimum)
  - Animatie-gebruik (te veel? te weinig? motion-sickness risico?)
- Onboarding: hoe lang van signup naar eerste "aha"-moment?
- Cognitive load: welke pagina's hebben te veel info? Welke te weinig?
- Vergelijk met Hevy, Strong, Whoop op informatie-architectuur

Output: `03-ui-ux.md` met findings + 5 mockup-suggesties (in Mermaid/ASCII waar visueel).

### FASE 4 — Security audit (subagent: `security-auditor`)
- **RLS-coverage**: query `pg_policies` (genereer een query). Welke tabellen missen policies? Welke policies zijn te ruim (`USING (true)`)?
- **API-routes**: voor ELKE route in `src/app/api/**/route.ts`:
  - Wordt de user geauthenticeerd? Via `supabase.auth.getUser()` of via service role (gevaarlijk)?
  - Wordt user_id uit token gehaald of uit request body (gevaarlijk)?
  - Zod-validatie aanwezig op input?
  - Rate limiting?
- **Webhook security**: Hevy webhook (`/api/ingest/hevy/webhook`) — wordt signature geverifieerd? HAE push (`/api/ingest/apple-health`) — hoe wordt geverifieerd dat dit van de juiste user komt?
- **Secrets**: API keys (Hevy per user) — waar opgeslagen? user_settings tabel? Versleuteld? Wie kan ze lezen?
- **OAuth tokens** (Google Calendar): worden refresh tokens veilig opgeslagen? Wat bij refresh-fail?
- **XSS**: chat output is markdown via react-markdown. Wordt rehype-sanitize gebruikt? Zo niet: P0.
- **CSRF**: API routes via fetch from same origin — Next.js heeft dit niet uit de doos. Worden methods/origin gecheckt?
- **SQL injection**: alleen supabase client = veilig, MAAR check `rpc()` calls met user input.
- **Dependencies**: `pnpm audit` runnen, output naar `data/dependency-audit.json`.
- **GDPR**: data export endpoint? Account-deletion endpoint die echt alle data wist?

Output: `04-security-audit.md` met OWASP-style severity matrix.

### FASE 5 — Performance (subagent: `perf-auditor`)
- **Bundle size**: run `pnpm build` en analyseer `.next/analyze`. Welke pagina's > 200KB JS? Welke libraries zijn onnodig zwaar?
- **Database queries**: vind N+1 issues. Loop alle `.from('table').select(...)` calls door. Specifiek: home dashboard aggregeert veel — wordt dat in 1 query of in 10?
- **Indexes**: query de DB voor missing indexes op:
  - workout_sets (workout_id, exercise_id)
  - daily_activity (user_id, date)
  - chat_messages (session_id, created_at)
  - alle FK columns
- **SWR caching**: zijn de revalidate-intervals zinvol? Wordt te vaak gerevalidated?
- **Server vs Edge runtime**: welke routes draaien op Edge? AI streaming hoort op Edge voor latency.
- **Image optimization**: wordt `next/image` overal gebruikt? Met juiste sizes prop?
- **Aggregations**: zijn de daily/weekly aggregaties écht precomputed of worden ze on-the-fly berekend op de home page?

Output: `05-performance.md` met concrete metrics + fix-prioriteit.

### FASE 6 — Productie-gereedheid voor 100+ klanten (subagent: `prod-readiness-auditor`)
Tabel met categorieën, status (✅/⚠️/❌), en wat er moet gebeuren:

**Infra:**
- Vercel Hobby tier: limieten? Wat bij 100 users? (Antwoord: niet voldoende, Pro $20/mo nodig of hoger)
- Supabase Free tier: 500MB DB, 1GB file storage, 50K MAU — wat is de stress-grens?
- Cron quotas: Vercel Hobby = 2 cron jobs, Pro = onbeperkt. Pulse heeft er nu 3. **P0 BLOCKER op huidig tier.**

**Multi-tenancy:**
- Zijn ALLE queries user-scoped via RLS, of alleen sommige?
- Hevy Pro is per-user ($5/mo). Wie betaalt? Bring-your-own-key of per-user-billing?
- HAE is iOS-only. Android-strategie?

**Onboarding:**
- Hoe komt een nieuwe user van signup naar werkende app? Welke stappen? Welke kunnen falen?
- Worden de seed-scripts (exercises, etc.) per user gedraaid?

**Billing:**
- Geen Stripe integration aanwezig (waarschijnlijk). Plan?
- Pricing tiers (free trial, pro, etc.)?

**Email:**
- Welke transactional emails? Hoe geconfigureerd? (Resend / SES / etc.)
- Account verificatie? Wachtwoord reset? Weekly digest?

**Observability:**
- Error tracking (Sentry)? Aanwezig of niet?
- Structured logging? Of console.log?
- Uptime monitoring?
- Status page?

**Data lifecycle:**
- Backup strategie (Supabase doet daily, maar PITR?)
- GDPR data export endpoint
- GDPR data deletion (echt deleten of soft-delete?)
- Data retention policy

**Legal:**
- Privacy policy aanwezig?
- ToS aanwezig?
- DPA voor GDPR-vereiste subprocessors (Anthropic, Vercel, Supabase, Hevy)?
- Health data status: in EU is fitness-data borderline-medical. Risico-inschatting.

**Support:**
- Helpdesk plan?
- In-app feedback mechanism?

Output: `06-production-readiness.md` met go/no-go per categorie + roadmap.

### FASE 7 — Product expert review (subagent: `sports-product-expert`)
Neem de rol aan van iemand die meerdere succesvolle sport-apps heeft gelanceerd (denk: Strong-founder niveau).

**Vergelijk met markt:**
- Hevy (Pulse haalt hier al data uit, dus rare positioning)
- Strong
- Whoop / Oura (readiness)
- Strava (running social)
- Future / Caliber (coaching)
- Fitbod (AI workout)

**Pulse's unique value:**
- AI coach met ALLE context (gym + run + sleep + nutrition + body comp). Niemand anders heeft dit zo compleet.
- Maar: is dit voor consumenten verkoopbaar of alleen voor power-users zoals Stef?

**Missing features die de markt heeft:**
- Apple Watch / WearOS app (huge differentiator)
- Voice logging tijdens workout ("log 3 sets of 10 bench at 60 kilos")
- Form-check via video (AI vision)
- Social / friends / challenges (retentie-driver)
- Habit streaks (gamification)
- Notifications & coaching nudges via push
- Wearable-integratie buiten Apple Health (Garmin, Polar, Whoop)
- PDF export van programma's
- Family/coach sharing
- Recipe database + meal plan generator
- Mind/meditation tracking

**Wat zou een product-PM schrappen?**
- Features die niemand gebruikt
- Te complexe UI die bezoekers afschrikt
- ACWR is wetenschappelijk goed, maar 90% van users snapt dit niet — moet uitleg, of weglaten voor pro-tier

**Pricing strategie:**
- Wat zou een $9.99/mo of $14.99/mo tier moeten bevatten?
- Free tier wat?

**Marketing-hook:**
- Wat is de 1-zin positionering? "Pulse: your AI coach that knows your whole training story."
- Voor wie? (early adopters: serieuze hobby-atleten, 25-45, betalingsbereid)

Output: `07-product-expert-review.md` met SWOT, feature-matrix, en go-to-market voorstel.

### FASE 8 — Bug RCA: Weekly Check-in plant verkeerde week (skill: `audit-checkin-bug`)
**Stef heeft expliciet gevraagd: waar gaat dit mis?**

Open de check-in skill apart en werk 'm grondig af. Output: `08-checkin-bug-rca.md`.

## Master Report
Aan het einde, schrijf `00-MASTER-REPORT.md`:
- Executive summary (1 pagina max)
- Top 10 P0 issues (must-fix voor productie)
- Top 10 P1 issues (should-fix binnen 4 weken)
- Top 5 quick wins (< 2 uur werk elk)
- AI-laag verbetervoorstel in 1 alinea
- Productie-gereedheid: ja/nee/voorwaarden
- Roadmap-suggestie (4 weken / 8 weken / 12 weken)

## Algemene regels tijdens audit
- **Geen code wijzigen** behalve in `.claude/audit-output/prs/`
- **Wel mogen lezen**: alles in src/, supabase/, scripts/, tests/, *.md
- **Niet gokken**: als je een vraag niet kunt beantwoorden uit de codebase, zet 'm in een sectie "Open vragen voor Stef" onderaan elk rapport
- **Cite bestand:regelnummer** voor elke claim
- **Severity definities:**
  - P0 = security risico of productie-blocker
  - P1 = significant functioneel of performance probleem
  - P2 = code quality / maintainability
  - P3 = nice to have
- **Geen vleierij**, geen "deze code is goed maar...". Gewoon: wat klopt, wat niet, wat te doen.
- **Concreet eindigen**: elk hoofdstuk eindigt met een "Direct uitvoerbare acties" sectie van maximaal 5 bullets.
