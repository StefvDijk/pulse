# Pulse — App Overview

**Wat is Pulse?**
Een persoonlijk health & training dashboard dat alle sportdata (gym, hardlopen, padel, dagelijkse activiteit, slaap, voeding, lichaamssamenstelling) samenbrengt in één Next.js web-app met een ingebouwde AI coach. Single-user app voor Stef, maar architectuur is multi-user ready.

De kerngedachte: stop het wekelijks copy-pasten van Hevy/Apple Health data naar een Claude Project. Laat álle data automatisch landen in één Supabase database, met een chat agent die direct toegang heeft tot je hele trainingsgeschiedenis.

---

## 1. Tech Stack

| Laag | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript strict) |
| Styling | Tailwind CSS v4 (dark-only, mobile-first) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email/password) |
| AI | Claude API via `@ai-sdk/anthropic` + Vercel AI SDK (`ai` v6) — streaming chat |
| Data fetching | SWR (client) + Server Components (server) |
| Charts | Recharts (lijn/bar/area), custom SVG (muscle heatmap, body composition bar) |
| Animatie | `motion` (Framer Motion successor) |
| Validatie | Zod (alle externe data) |
| Icons | `lucide-react` |
| Markdown | `react-markdown` + `remark-gfm` (chat output) |
| Hosting | Vercel (Hobby tier) + Vercel Cron Functions |
| Package manager | pnpm |
| E2E tests | Playwright |
| Externe API's | Hevy API (gym), Health Auto Export (Apple Health push), Google Calendar API |

---

## 2. Data-bronnen & Ingest

Drie inputkanalen die allemaal in dezelfde Supabase-tabellen landen:

### 2.1 Hevy (krachttraining)
- **Pull-sync** via `/api/cron/hevy-sync` (dagelijks 06:00 UTC) en handmatige trigger via `/api/ingest/hevy/sync`.
- Webhook endpoint `/api/ingest/hevy/webhook` voor live updates.
- Synchroniseert: workouts, exercises, sets, routines.
- Fuzzy matching tegen `exercise_definitions` (omdat Hevy exercise-namen niet gestandaardiseerd zijn).
- Verrijking: totaal volume (kg), set/exercise count, PR-detectie, hartslag/calorieën vanaf Apple Watch.

### 2.2 Apple Health via Health Auto Export (iOS app, push)
- Endpoint: `/api/ingest/apple-health` ontvangt JSON-payloads.
- Defensieve Zod-parsing (formaat varieert per HAE-configuratie).
- Deduplicatie op `apple_health_id`.
- Verwerkt: runs (incl. Runna-sync), padel sessies, dagelijkse activiteit (steps, calories, HR, HRV), slaap (deep/REM/light), lichaamsgewicht, lichaamssamenstelling (vet%, spiermassa, viscerale vet, body water).
- Filter: Apple Watch BMR-ruis wordt eruit gefilterd voor body composition.

### 2.3 Handmatige input
- Voeding via natural language in `/nutrition` (Claude analyseert: calorieën/macros).
- Blessures via chat (worden gelogd in `injury_logs` met AI-analyse).
- Body composition handmatig invoerbaar als HAE niet beschikbaar is.

---

## 3. Routes (Pages)

| Route | Functie |
|---|---|
| `/` | **Home** — readiness signaal, today's workout, week-at-a-glance, daily health bar, activity feed, coach nudge, sync-button |
| `/schema` | **Trainingsschema** — actief 4-weeks blok, week-view, schedule overrides, reschedule, AI-gegenereerd of vanuit Hevy routines |
| `/progress` | **Progressie** — kracht per movement pattern, hardloop pace/afstand, PR-lijst, per-exercise drilldown |
| `/chat` | **Coach** — full-page chat met Claude, met history persistentie en context preview |
| `/belasting` | **Belasting** — rolling acute:chronic workload ratio (ACWR), zone-bar, trend-sparkline |
| `/goals` | **Doelen** — kracht/run/padel/nutrition/body composition doelen, voortgang naar deadline |
| `/nutrition` | **Voeding** — dag-overzicht macro's, eiwit-tracker, natural language input |
| `/check-in` | **Wekelijkse check-in** — AI-gestuurde review van afgelopen week + voorgestelde planning komende week + Google Calendar write |
| `/check-in/history` | Vorige check-ins / weekly reviews |
| `/settings` | API-keys, doelen (eiwit/kcal), AI custom instructions, Google Calendar connectie, profile |
| `/workouts/[id]` | Detail van één workout (sets/reps/RPE, PR-badges, biometrie) |
| `/auth/login` & `/auth/signup` | Supabase Auth |

**Navigatie:** bottom-tab op mobiel (Home, Schema, Progressie, Coach), sidebar op desktop. Floating mini-chat is op alle pagina's beschikbaar.

---

## 4. API Endpoints (Route Handlers)

Functioneel gegroepeerd:

### 4.1 Ingest
- `POST /api/ingest/apple-health` — HAE push endpoint
- `POST /api/ingest/hevy/sync` — handmatige sync
- `POST /api/ingest/hevy/webhook` — Hevy webhook

### 4.2 Dashboard / overzichten
- `GET /api/dashboard` — home-page aggregatie
- `GET /api/health/today` — dagelijkse health metrics
- `GET /api/readiness` — readiness score (slaap + HRV + RHR + workload)
- `GET /api/workload` — ACWR berekening
- `GET /api/muscle-map` — spiergroep belasting
- `GET /api/activities` — gemixte activity feed
- `GET /api/workouts` + `/[id]` — workouts
- `GET /api/progress` + `/exercise` + `/exercises`
- `GET /api/trends` — maand/kwartaal/jaar vergelijkingen
- `GET /api/body-composition` — gewicht/vet%/spiermassa trend

### 4.3 AI / Chat
- `POST /api/chat` — streaming chat met context assembler
- `GET /api/chat/history` — eerdere sessies
- `GET /api/ai-context-preview` — debug: welke context wordt verstuurd?
- `POST /api/nutrition/analyze` — natural language → macros
- `GET /api/nutrition/summary` — dag/week macro overzicht
- `GET/POST /api/coaching-memory` — persistente memory items van de coach

### 4.4 Check-in (weekly review v1.1)
- `POST /api/check-in/analyze` — AI analyseert afgelopen week
- `POST /api/check-in/plan` — genereer week-planning
- `GET /api/check-in/plan/conflicts` — check Google Calendar conflicten
- `POST /api/check-in/confirm` — bevestig planning + schrijf naar Google Cal
- `GET /api/check-in/status` + `/history` + `/review`

### 4.5 Schema & Goals
- `GET/POST /api/schema` + `/week` + `/overrides` + `/reschedule`
- CRUD `/api/goals` + `/[id]`

### 4.6 Google Calendar
- `GET /api/calendar/auth` (OAuth start)
- `GET /api/calendar/callback` (OAuth callback)
- `DELETE /api/calendar/disconnect`
- `GET/POST /api/calendar/events`

### 4.7 Aggregaties & Cron
- `POST /api/aggregations/compute` — herbereken aggregaties
- `GET /api/cron/daily-aggregate` (02:00 UTC dagelijks)
- `GET /api/cron/weekly-aggregate` (03:00 UTC maandag)
- `GET /api/cron/hevy-sync` (06:00 UTC dagelijks)

### 4.8 Admin / Settings
- `GET/PATCH /api/settings`
- `POST /api/admin/seed-memory`

---

## 5. Database (PostgreSQL via Supabase)

20 migraties in `supabase/migrations/`. Belangrijkste tabellen:

### Core
- `profiles` — gebruikersprofiel (gewicht, lengte, dieet, activiteitsniveau)
- `user_settings` — API-keys, eiwitdoel, trainingsdoel per week, AI custom instructions
- `exercise_definitions` — referentietabel (Hevy ID, naam, primary/secondary muscle group, movement pattern, equipment, category)

### Trainingsdata
- `workouts` + `workout_exercises` + `workout_sets` — Hevy data, verrijkt
- `runs` — hardloopsessies (pace, HR, afstand, type)
- `padel_sessions` — padel (HR, intensiteit, type)
- `hevy_routines` — opgeslagen routines uit Hevy (voor schema-vergelijking)
- `personal_records` — PR's per exercise (weight/reps/distance/pace/duration)

### Health / biometrie
- `daily_activity` — steps, calories, HR, HRV, stand hours
- `sleep_logs` — slaap-stadia (deep/REM/light/awake), efficiency
- `body_weight_logs` — gewicht over tijd
- `body_composition_logs` — vet%, spiermassa, viscerale vet, body water

### AI / Coach
- `chat_sessions` + `chat_messages` — chat historie met message_type categorisatie + token usage
- `injury_logs` — blessures met AI-analyse en gerelateerde workouts
- `coaching_memory` — persistente facts die Claude moet onthouden

### Planning
- `training_schemas` — actieve schema's met workout_schedule (JSONB) en progression rules
- `schema_block_summaries` — samenvatting na afronding 4-weeks blok
- `goals` — doelen (kracht/run/padel/nutrition/body comp)

### Voeding
- `nutrition_logs` — raw input + AI-geschatte macros + confidence
- `daily_nutrition_summary` — totalen per dag tegen targets

### Aggregaties (precomputed voor performance)
- `daily_aggregations` — minuten/sport, sets, tonnage, muscle_load JSONB, training load score
- `weekly_aggregations` — week-totalen + **acute_load, chronic_load, acute_chronic_ratio, workload_status**
- `monthly_aggregations` — maand-overzicht + highlights + PRs

### Overig
- `google_calendar_tokens` — OAuth tokens
- `weekly_reviews` — opgeslagen weekly check-ins

**RLS:** elke tabel heeft policies; users zien alleen eigen data; service role kan alles (voor cron en ingest).

---

## 6. AI / Coach Layer

### 6.1 Context Assembler (`src/lib/ai/`)
Bouwt per chat-request een minimale, relevante context op (max ~8000 tokens). Strategie:
- Detecteer **message_type** uit user input (general / injury_report / nutrition_log / schema_request / progress_question / weekly_review).
- Selecteer per type: actief schema, week-aggregaties, recente workouts/runs, openstaande blessures, doelen, coaching memory items, custom instructions.
- Streamt response terug via Vercel AI SDK.

### 6.2 System Prompts
In `src/lib/ai/prompts/` — gescheiden per use-case (chat-system, nutrition-analysis, schema-generation, weekly-review).

### 6.3 Write-back
Claude kan via structured outputs/tool calls de database aanpassen:
- Voedingslog opslaan na NL-analyse
- Blessure registreren in `injury_logs`
- Nieuw schema voorstellen → opslaan in `training_schemas`
- Memory items aanmaken (`coaching_memory`)

### 6.4 Weekly Check-in (v1.1)
Wizard die wekelijks:
1. Afgelopen week analyseert (adherence, PR's, workload, slaap)
2. Schema voor komende week voorstelt op basis van schema + werkelijke beschikbaarheid
3. Conflicten checkt tegen Google Calendar
4. Sessies in Google Calendar schrijft na bevestiging

---

## 7. Kern-features (functioneel)

| Feature | Hoe het werkt |
|---|---|
| **Readiness signaal** | Combineert slaap-uren/efficiency, HRV-afwijking, RHR-trend, recente workload → score met kleurcode op home |
| **Acute:Chronic Workload Ratio (ACWR)** | 7-daags acute load / 28-daags chronic load → zone (low/optimal/warning/danger). Toont op `/belasting` met zone-bar + sparkline |
| **Muscle heatmap** | Body-figure SVG die kleurt op basis van wekelijkse spiergroep-belasting per workout (compound + isolation gewogen) |
| **Personal Records** | Auto-detectie bij elke nieuwe set/run; toont op `/progress` met progressie over tijd |
| **Voedings-input via NL** | "twee eieren en havermout met banaan" → Claude → kcal + macro's + confidence-rating |
| **Schema engine** | Schema's met workout_schedule (dagen + oefeningen) + progressie-regels; per-week overrides; reschedule met conflictdetectie |
| **Trends** | Maand-/kwartaal-/jaar-vergelijkingen op tonnage, km, sessies, kracht, body composition |
| **Body composition tracking** | Lean-to-fat ratio, composition bar (vet/spiermassa/water), trend over tijd |
| **Coach memory** | Persistente facts die Claude over je weet (vakanties, voorkeuren, blessurehistorie) — zichtbaar in settings |
| **Activity feed** | Chronologische mix van workouts/runs/padel/PR's op home |

---

## 8. Cron Jobs (Vercel)

| Pad | Schedule | Doel |
|---|---|---|
| `/api/cron/hevy-sync` | `0 6 * * *` (06:00 UTC) | Dagelijks Hevy data ophalen |
| `/api/cron/daily-aggregate` | `0 2 * * *` (02:00 UTC) | Per dag aggregaties berekenen |
| `/api/cron/weekly-aggregate` | `0 3 * * 1` (maandag 03:00 UTC) | Week-aggregaties + ACWR |

---

## 9. Project Structuur

```
pulse/
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   ├── components/             # React componenten per domein
│   │   ├── home/, dashboard/, chat/, check-in/
│   │   ├── goals/, nutrition/, progress/, schema/
│   │   ├── trends/, workload/, workout/, muscles/
│   │   ├── settings/, layout/, shared/, ui/
│   ├── lib/                    # Business logic
│   │   ├── supabase/           # client/server/admin clients
│   │   ├── hevy/               # Hevy API client + sync + mappers
│   │   ├── apple-health/       # HAE parser + mappers
│   │   ├── ai/                 # Context assembler + prompts
│   │   ├── aggregations/, goals/, nutrition/, muscle-map/
│   │   ├── google/             # Google Calendar OAuth
│   │   ├── wger/               # Exercise reference data
│   │   ├── auth.ts, rate-limit.ts, motion-presets.ts, chart-styles.ts
│   ├── hooks/                  # Custom SWR hooks
│   └── types/                  # database.ts (generated)
├── supabase/migrations/        # 20 SQL migraties
├── scripts/                    # Seed-scripts (exercises, test data, history)
├── tests/                      # Playwright E2E
├── pulse/design/design_handoff_pulse_v2/   # Canonical design system
├── public/sf-pro-display/      # Custom font
└── PRD.md, CLAUDE.md, BACKLOG, PLAN-*.md   # Specs en plannen
```

---

## 10. Design System

Canonical: `pulse/design/design_handoff_pulse_v2/`. Dark-only, SF Pro Display, achtergrond `#15171F`. Sport-accent kleuren:
- Gym: `#00E5C7` (teal)
- Run: `#FF5E3A` (oranje)
- Padel: `#FFB020` (geel)
- Cycle: `#9CFF4F` (groen)
- Coach orb: `#D97757` (Anthropic koraal)

Card-patroon: `bg.surface (#1E2230)` + `0.5px border` + `radius.lg (22px)`, geen drop shadows. Tokens leven in `tokens.js` en worden via Tailwind config beschikbaar gemaakt.

---

## 11. Development Workflow

```bash
# Dependencies
pnpm install

# Supabase lokaal
supabase start
supabase db push

# Seeds
pnpm seed:exercises       # exercise_definitions referentie
pnpm seed:stef            # Stef's profiel + settings
pnpm seed:history         # historische workouts/runs

# Dev server
pnpm dev                  # http://localhost:3000

# Type generation na migratie
supabase gen types typescript --local > src/types/database.ts

# Build & lint
pnpm build && pnpm lint

# E2E tests
pnpm test:e2e
pnpm test:e2e:ui
```

**Test account (lokaal):** `stef@pulse.test` / `testpassword123`

---

## 12. Externe Dependencies / kosten

| Service | Kosten | Doel |
|---|---|---|
| Hevy Pro | ~€5/maand | API-toegang voor workout data |
| Health Auto Export | ~€3/maand (iOS) | Apple Health → Pulse push |
| Claude API | ~€5-15/maand | Chat agent, analyses, schema's |
| Vercel Hobby | Gratis | Hosting + cron |
| Supabase Free | Gratis | Database + auth |

---

## 13. Status

- ✅ Data-pipeline (Hevy + HAE ingest, aggregaties, cron)
- ✅ AI-laag (chat, context assembler, memory, write-back)
- ✅ UX-redesign (v2 design system, dark theme, mobile-first)
- ✅ Body composition tracking met lean-to-fat ratio
- ✅ Belasting-pagina met ACWR
- 🔄 Homescreen verbeteringen — zie `PLAN-HOMESCREEN-REDESIGN.md`
- 🔄 Weekly check-in v1.1 (Google Calendar write, interactive adjustments) — zie `PLAN-WEEKLY-CHECKIN.md`
- 📋 Volledige product spec: `PRD.md`
