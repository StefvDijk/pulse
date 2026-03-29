# PRD: Pulse — Personal Health & Training Dashboard

**Versie:** 1.0
**Datum:** 12 maart 2026
**Auteur:** Stef (Product Owner) + Claude (Architect)
**Status:** Ready for Development

---

## 1. Product Visie

### 1.1 Probleem

Sportdata zit verspreid over 5+ apps (Hevy, Runna, Apple Workouts, Apple Health, Claude Projects). Geen enkele app aggregeert al deze bronnen tot een coherent beeld. Het gevolg: geen inzicht in totale belasting, geen correlatie tussen sporten, geen intelligente analyse, en wekelijks handmatig copy-pasten naar Claude voor coaching.

### 1.2 Oplossing

Pulse is een persoonlijk health & training dashboard dat alle sportdata samenbrengt in één interface met twee modi:

1. **Dashboard (passief)** — visueel overzicht van je week/maand/kwartaal. Je kijkt wanneer je wilt. Geen notificaties, geen alerts.
2. **Chat Agent (actief)** — conversationele AI die je trainingsdata kent. Stel vragen, meld blessures, log voeding in natural language, vraag om schema's. De agent heeft directe toegang tot al je data.

### 1.3 Kernprincipes

- **Data ownership**: alle data in eigen Supabase database, geen vendor lock-in
- **Pull, niet push**: geen notificaties of alerts tenzij expliciet gevraagd. De gebruiker bepaalt wanneer hij kijkt
- **Intelligence over visualisatie**: het dashboard toont niet alleen data, maar interpreteert het
- **Natural language first**: voedingsinput, blessure-meldingen, en vragen gaan via de chat agent
- **Single user first, multi-user ready**: gebouwd voor Stef, architectuur klaar voor uitbreiding

---

## 2. Gebruikersprofiel (v1: Stef)

### 2.1 Sportprofiel

| Eigenschap | Waarde |
|---|---|
| Leeftijd | 32 |
| Woonplaats | Amsterdam |
| Sporten | Gym (krachttraining), Hardlopen, Padel |
| Gym frequentie | 3x per week |
| Hardloop frequentie | 2x per week |
| Padel frequentie | 1x per week |
| Dieet | Grotendeels vegetarisch |
| Tracking apps | Hevy (gym), Runna (hardlopen), Apple Workouts (padel), Apple Health (dagelijkse activiteit) |
| Coaching | Claude Project (wekelijkse check-ins, schema's) |
| Schema cyclus | Nieuw schema elke 4 weken |

### 2.2 Huidige Workflow

1. Gym: schema in Claude Project → routine in Hevy → workout uitvoeren met Hevy op Apple Watch → log in Hevy
2. Hardlopen: schema in Runna → run uitvoeren met Runna → log in Runna (synct naar Apple Health)
3. Padel: sessie spelen → Apple Workouts logt via Apple Watch
4. Wekelijks (zondag): Hevy workouts handmatig delen met Claude Project voor coaching feedback
5. Dagelijkse activiteit: Apple Health logt stappen, beweging, hartslag automatisch

### 2.3 Pijnpunten

- Geen totaaloverzicht van trainingsbelasting (gym + hardlopen + padel samen)
- Geen inzicht in spiergroep-balans of overbelasting
- Handmatig delen van data met Claude kost tijd en is foutgevoelig
- Geen voedingstracking die past bij zijn workflow (wil niet elke calorie loggen)
- Geen correlatie tussen trainingsdata en herstel/blessures
- Geen historisch overzicht (wat deed ik 3 maanden geleden?)

---

## 3. Tech Stack

### 3.1 Overzicht

| Component | Technologie | Reden |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | Bekend van Groene Broeders, SSR, API routes |
| Styling | Tailwind CSS | Snel, consistent, goed voor data-heavy UI |
| Charting | Recharts + custom SVG | Recharts voor standaard charts, custom SVG voor heatmaps |
| Hosting | Vercel | Gratis tier, goede Next.js integratie |
| Database | Supabase (PostgreSQL) | Bekend, gratis tier, Row Level Security, realtime |
| Auth | Supabase Auth | Email/password, multi-user ready |
| AI/Chat | Claude API (claude-sonnet-4-20250514) | Intelligent genoeg voor coaching, snel genoeg voor chat |
| Data ingest (Apple Health) | Health Auto Export (iOS app, €3/maand) | Pusht Apple Health data naar REST endpoint |
| Data ingest (Hevy) | Hevy API (Pro subscription) | Officiële API, gestructureerde workout data |
| Data ingest (Runna) | Via Apple Health sync | Runna synct naar Apple Health, Health Auto Export vangt het op |
| Cron/scheduled jobs | Vercel Cron Functions | Aggregatie-berekeningen, data cleanup |
| State management | React Context + SWR | SWR voor data fetching, Context voor UI state |

### 3.2 Externe Dependencies

| Dependency | Type | Kosten | Nodig voor |
|---|---|---|---|
| Hevy Pro | Subscription | ~€5/maand | API toegang voor workout data |
| Health Auto Export | iOS App | ~€3/maand | Apple Health data naar Pulse API |
| Claude API | Pay-per-use | ~€5-15/maand geschat | Chat agent, voedingsanalyse, schema's |
| Vercel | Hosting | Gratis (Hobby tier) | Frontend + API routes |
| Supabase | Database | Gratis tier (500MB, 50k rows) | Alle data opslag |

### 3.3 Repository Structuur

```
pulse/
├── .github/
│   └── CLAUDE.md                    # Claude Code instructies
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Dashboard home (week overview)
│   │   ├── progress/
│   │   │   └── page.tsx             # Progressie tab
│   │   ├── nutrition/
│   │   │   └── page.tsx             # Voeding tab
│   │   ├── trends/
│   │   │   └── page.tsx             # Trends tab
│   │   ├── goals/
│   │   │   └── page.tsx             # Doelen tab
│   │   ├── chat/
│   │   │   └── page.tsx             # Chat agent (full page)
│   │   ├── settings/
│   │   │   └── page.tsx             # Instellingen
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   └── api/
│   │       ├── ingest/
│   │       │   ├── apple-health/route.ts    # Endpoint voor Health Auto Export
│   │       │   └── hevy/
│   │       │       ├── sync/route.ts        # Handmatige Hevy sync trigger
│   │       │       └── webhook/route.ts     # Hevy webhook endpoint
│   │       ├── chat/route.ts                # Chat agent endpoint (streaming)
│   │       ├── nutrition/analyze/route.ts   # Voedingsanalyse endpoint
│   │       ├── schema/generate/route.ts     # Schema generatie endpoint
│   │       ├── aggregations/
│   │       │   └── compute/route.ts         # Aggregatie herberekening
│   │       └── cron/
│   │           ├── daily-aggregate/route.ts
│   │           ├── weekly-aggregate/route.ts
│   │           └── hevy-sync/route.ts       # Periodieke Hevy sync
│   ├── components/
│   │   ├── ui/                      # Generieke UI componenten
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── ChatBubble.tsx
│   │   ├── dashboard/               # Dashboard-specifieke componenten
│   │   │   ├── WeekOverview.tsx
│   │   │   ├── WorkloadMeter.tsx          # Acute:chronic ratio meter
│   │   │   ├── MuscleHeatmap.tsx          # Body heatmap
│   │   │   ├── SportSplit.tsx             # Uren per sport
│   │   │   ├── AdherenceTracker.tsx       # Geplande vs gedane trainingen
│   │   │   ├── TrainingBlockIndicator.tsx # Positie in trainingsblok
│   │   │   └── ActivityRings.tsx          # Dagelijkse activiteit
│   │   ├── progress/
│   │   │   ├── StrengthChart.tsx          # Kracht per bewegingspatroon
│   │   │   ├── RunningChart.tsx           # Pace/afstand over tijd
│   │   │   ├── VolumeChart.tsx            # Totaal volume per sport
│   │   │   ├── GoalProgress.tsx           # Voortgang naar doel
│   │   │   └── PRList.tsx                 # Personal records
│   │   ├── nutrition/
│   │   │   ├── NutritionInput.tsx         # Natural language input
│   │   │   ├── MacroSummary.tsx           # Dag macro overzicht
│   │   │   ├── ProteinTracker.tsx         # Eiwit vs target
│   │   │   └── DayIndicator.tsx           # Globale dag-indicator
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx          # Chat UI
│   │   │   ├── ChatMessage.tsx            # Enkel bericht
│   │   │   ├── ChatInput.tsx              # Input veld
│   │   │   └── ChatSuggestions.tsx        # Voorgestelde vragen
│   │   ├── trends/
│   │   │   ├── MonthComparison.tsx
│   │   │   ├── QuarterComparison.tsx
│   │   │   └── YearAgoSnapshot.tsx
│   │   └── layout/
│   │       ├── Navigation.tsx             # Bottom nav (mobiel) / sidebar (desktop)
│   │       ├── Header.tsx
│   │       └── MiniChat.tsx               # Floating chat button + mini chat
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                  # Browser client
│   │   │   ├── server.ts                  # Server client
│   │   │   ├── admin.ts                   # Service role client (voor API routes)
│   │   │   └── types.ts                   # Generated database types
│   │   ├── hevy/
│   │   │   ├── client.ts                  # Hevy API client
│   │   │   ├── types.ts                   # Hevy API types
│   │   │   ├── sync.ts                    # Sync logic (API → Supabase)
│   │   │   └── mappers.ts                 # Hevy data → Pulse schema mapping
│   │   ├── apple-health/
│   │   │   ├── parser.ts                  # Health Auto Export JSON parser
│   │   │   ├── types.ts                   # Apple Health data types
│   │   │   └── mappers.ts                 # AH data → Pulse schema mapping
│   │   ├── ai/
│   │   │   ├── client.ts                  # Claude API client
│   │   │   ├── context-assembler.ts       # Bouwt context op basis van vraag-type
│   │   │   ├── prompts/
│   │   │   │   ├── chat-system.ts         # System prompt voor chat agent
│   │   │   │   ├── nutrition-analysis.ts  # Prompt voor voedingsanalyse
│   │   │   │   ├── schema-generation.ts   # Prompt voor schema generatie
│   │   │   │   ├── weekly-summary.ts      # Prompt voor weeksamenvatting
│   │   │   │   └── injury-analysis.ts     # Prompt voor blessure-analyse
│   │   │   └── types.ts
│   │   ├── aggregations/
│   │   │   ├── daily.ts                   # Dagelijkse aggregatie-logica
│   │   │   ├── weekly.ts                  # Wekelijkse aggregatie-logica
│   │   │   ├── monthly.ts                # Maandelijkse aggregatie-logica
│   │   │   ├── workload.ts               # Acute:chronic ratio berekening
│   │   │   ├── muscle-groups.ts          # Spiergroep belasting berekening
│   │   │   └── movement-patterns.ts      # Bewegingspatroon classificatie
│   │   ├── nutrition/
│   │   │   ├── estimator.ts              # Macro/calorie schatting vanuit AI response
│   │   │   └── targets.ts               # Bereken targets op basis van profiel + activiteit
│   │   ├── constants/
│   │   │   ├── muscle-groups.ts          # Spiergroep definities en mapping
│   │   │   ├── movement-patterns.ts     # Push/pull/squat/hinge classificatie
│   │   │   ├── exercise-mappings.ts     # Hevy exercises → spiergroepen + patronen
│   │   │   └── sport-types.ts           # Sport type definities
│   │   └── utils/
│   │       ├── date.ts                   # Datum helpers
│   │       ├── format.ts                 # Formatting helpers
│   │       └── calculations.ts           # Algemene berekeningen
│   ├── hooks/
│   │   ├── useWorkouts.ts
│   │   ├── useAggregations.ts
│   │   ├── useNutrition.ts
│   │   ├── useGoals.ts
│   │   ├── useChat.ts
│   │   └── useProfile.ts
│   └── types/
│       ├── database.ts                   # Supabase generated types
│       ├── workout.ts                    # Workout domain types
│       ├── nutrition.ts                  # Nutrition domain types
│       └── chat.ts                       # Chat domain types
├── supabase/
│   └── migrations/                       # Database migraties
│       ├── 001_initial_schema.sql
│       ├── 002_aggregation_tables.sql
│       ├── 003_nutrition_tables.sql
│       ├── 004_chat_tables.sql
│       ├── 005_goals_tables.sql
│       └── 006_rls_policies.sql
├── public/
│   ├── body-front.svg                    # Body outline voor heatmap (voorkant)
│   └── body-back.svg                     # Body outline voor heatmap (achterkant)
├── scripts/
│   ├── seed-exercises.ts                 # Seed exercise → muscle group mappings
│   └── seed-test-data.ts                # Test data voor ontwikkeling
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local.example
```

---

## 4. Architectuur

### 4.1 Systeemoverzicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA BRONNEN                                │
│                                                                     │
│  ┌──────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │   Hevy API   │  │ Health Auto Export  │  │    Gebruiker       │  │
│  │  (workouts,  │  │  (runs, padel,     │  │  (voeding, goals,  │  │
│  │   routines)  │  │   stappen, HR,     │  │   blessures, chat) │  │
│  │              │  │   HRV, activiteit) │  │                    │  │
│  └──────┬───────┘  └─────────┬──────────┘  └─────────┬──────────┘  │
│         │                    │                        │             │
└─────────┼────────────────────┼────────────────────────┼─────────────┘
          │                    │                        │
          ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API LAYER (Next.js API Routes)               │
│                                                                     │
│  /api/ingest/hevy/*          /api/ingest/apple-health    /api/chat  │
│  /api/cron/hevy-sync         /api/cron/daily-aggregate   /api/nutr  │
│  /api/cron/weekly-aggregate  /api/schema/generate                   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    CONTEXT ASSEMBLER                          │   │
│  │  Bepaalt welke data Claude nodig heeft per vraag-type        │   │
│  │  Haalt relevante aggregaties + raw data uit database         │   │
│  │  Bouwt optimale prompt voor het context window               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      CLAUDE API                               │   │
│  │  claude-sonnet-4-20250514                                     │   │
│  │  Streaming responses voor chat                                │   │
│  │  JSON mode voor voedingsanalyse                               │   │
│  │  Schema generatie met gestructureerde output                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (PostgreSQL)                            │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ ┌────────────┐ │
│  │  Raw Data    │ │ Aggregaties │ │  AI Generated │ │  User Data │ │
│  │             │ │             │ │               │ │            │ │
│  │ workouts    │ │ daily_agg   │ │ nutrition_logs│ │ profiles   │ │
│  │ exercises   │ │ weekly_agg  │ │ chat_messages│ │ goals      │ │
│  │ sets        │ │ monthly_agg │ │ schemas      │ │ injury_logs│ │
│  │ runs        │ │ schema_     │ │ weekly_      │ │ settings   │ │
│  │ padel_sess  │ │  block_     │ │  summaries   │ │            │ │
│  │ activity    │ │  summaries  │ │              │ │            │ │
│  │ heart_rate  │ │             │ │              │ │            │ │
│  └─────────────┘ └─────────────┘ └───────────────┘ └────────────┘ │
│                                                                     │
│  Row Level Security: alle queries gefilterd op user_id              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                              │
│                                                                     │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │Dashboard │ │Progressie │ │Voeding   │ │Trends  │ │Chat      │ │
│  │(week)    │ │           │ │          │ │        │ │Agent     │ │
│  └──────────┘ └───────────┘ └──────────┘ └────────┘ └──────────┘ │
│                                                                     │
│  Mobile-first responsive design                                     │
│  Bottom navigation (mobiel) / Sidebar (desktop)                     │
│  Floating chat button op alle pagina's                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow: Hevy Sync

```
Hevy API ──► /api/cron/hevy-sync (elke 15 min via Vercel Cron)
         │
         ├─► Fetch nieuwe workouts sinds laatste sync
         ├─► Map naar Pulse schema (workouts, exercises, sets)
         ├─► Classificeer exercises → spiergroepen + bewegingspatronen
         ├─► Schrijf naar database
         └─► Trigger aggregatie herberekening voor betreffende dag/week

Hevy Webhook ──► /api/ingest/hevy/webhook
              │
              └─► Zelfde flow als boven, maar real-time bij workout completion
```

### 4.3 Data Flow: Apple Health

```
Apple Watch ──► Apple Health ──► Health Auto Export (iOS)
                                    │
                                    ├─► POST /api/ingest/apple-health
                                    │   (configureerbaar: elke 15/30/60 min)
                                    │
                                    ├─► Parse JSON payload
                                    ├─► Categoriseer: run / padel / activiteit / hartslag / HRV
                                    ├─► Dedupliceer (Apple Health stuurt soms overlappende data)
                                    ├─► Schrijf naar respectievelijke tabellen
                                    └─► Trigger aggregatie herberekening
```

### 4.4 Data Flow: Chat Agent

```
Gebruiker typt vraag
         │
         ▼
Frontend ──► POST /api/chat (streaming)
         │
         ├─► Classificeer vraag-type:
         │   - general_chat
         │   - injury_report
         │   - nutrition_log
         │   - nutrition_question
         │   - schema_request
         │   - progress_question
         │   - weekly_review
         │
         ├─► Context Assembler haalt relevante data:
         │   ┌─────────────────────────────────────────────────┐
         │   │ injury_report:                                   │
         │   │   - workouts afgelopen 14 dagen (detail)         │
         │   │   - spiergroep verdeling 4 weken (aggregaat)     │
         │   │   - eerdere blessure logs (zelfde locatie)       │
         │   │   - huidig schema                                │
         │   │                                                  │
         │   │ nutrition_log:                                    │
         │   │   - voedingslogs vandaag                          │
         │   │   - activiteit vandaag (calorieën verbrand)       │
         │   │   - workout vandaag (indien aanwezig)             │
         │   │   - persoonlijk profiel (gewicht, doelen)         │
         │   │                                                  │
         │   │ schema_request:                                   │
         │   │   - huidige schema + adherence                    │
         │   │   - vorige 3 schema's (samenvatting)              │
         │   │   - progressie per bewegingspatroon 3 maanden     │
         │   │   - actieve doelen                                │
         │   │   - recente blessure meldingen                    │
         │   │                                                  │
         │   │ progress_question:                                │
         │   │   - relevante aggregaties (week/maand/kwartaal)   │
         │   │   - PR lijst                                      │
         │   │   - doel voortgang                                │
         │   │                                                  │
         │   │ weekly_review:                                     │
         │   │   - weekly aggregatie huidige week                 │
         │   │   - vergelijking 4-weeks gemiddelde                │
         │   │   - adherence aan schema                           │
         │   │   - voedingsgemiddelden van de week                │
         │   │   - blessure logs van de week                      │
         │   └─────────────────────────────────────────────────┘
         │
         ├─► Bouw prompt: system prompt + context + user vraag
         ├─► Stream Claude response naar frontend
         ├─► Sla chat bericht op in database
         │
         └─► Write-back (indien van toepassing):
             - nutrition_log → schat macro's, sla op in nutrition_logs
             - injury_report → sla op in injury_logs
             - schema_request → sla schema op in schemas tabel
```

### 4.5 Context Assembler: Detail

De Context Assembler is het kritieke component dat ervoor zorgt dat Claude altijd de juiste data krijgt zonder het context window te overbelasten.

**Principe:** Claude krijgt nooit meer dan ~8000 tokens aan data-context. De assembler comprimeert en selecteert op basis van relevantie.

**Compressie-strategie per data-type:**

| Data type | Detail niveau | Voorbeeld output |
|---|---|---|
| Workout (recent, <7 dagen) | Volledig | "Ma 10/3: Upper Body - Bench Press 4x8@70kg, OHP 3x10@40kg, ..." |
| Workout (7-14 dagen) | Samengevat | "Ma 3/3: Upper Body - 6 oefeningen, 22 sets, focus: chest/shoulders" |
| Workout (>14 dagen) | Alleen aggregaat | Via weekly/monthly aggregaties |
| Schema | Gestructureerd | JSON met oefeningen, sets, reps, progressieregels |
| Voeding vandaag | Volledig | Alle logs met geschatte macro's |
| Voeding historisch | Gemiddelden | "Gemiddeld deze week: 2100kcal, 110g eiwit, 85g vet, 240g koolhydraten" |
| Blessure logs | Volledig (alle) | Alle blessure meldingen met datum, locatie, context |
| Doelen | Volledig (alle) | Alle actieve doelen met voortgang |

---

## 5. Database Schema

### 5.1 Tabellen

#### Core tabellen

```sql
-- Gebruikersprofiel
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name TEXT NOT NULL,
    date_of_birth DATE,
    weight_kg DECIMAL(5,1),          -- voor calorie/eiwit berekeningen
    height_cm INTEGER,
    activity_level TEXT DEFAULT 'moderate', -- sedentary, light, moderate, very_active
    dietary_preference TEXT DEFAULT 'omnivore', -- omnivore, vegetarian, vegan, pescatarian
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gebruikersinstellingen
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES profiles(id),
    hevy_api_key TEXT,                    -- Encrypted
    health_auto_export_token TEXT,        -- Token voor API authenticatie
    protein_target_per_kg DECIMAL(3,1) DEFAULT 1.8,  -- gram per kg lichaamsgewicht
    preferred_unit_system TEXT DEFAULT 'metric',       -- metric / imperial
    weekly_training_target JSONB DEFAULT '{"gym": 3, "running": 2, "padel": 1}',
    last_hevy_sync_at TIMESTAMPTZ,
    last_apple_health_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Workout tabellen

```sql
-- Workouts (gym sessies van Hevy)
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    hevy_workout_id TEXT,                -- Originele Hevy ID
    title TEXT NOT NULL,                  -- "Upper Body", "Leg Day", etc.
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'hevy', -- hevy, manual
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, hevy_workout_id)
);

-- Exercise definities (reference tabel)
CREATE TABLE exercise_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hevy_exercise_id TEXT,               -- Originele Hevy exercise template ID
    name TEXT NOT NULL,
    primary_muscle_group TEXT NOT NULL,   -- chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, forearms
    secondary_muscle_groups TEXT[],       -- Array van aanvullende spiergroepen
    movement_pattern TEXT NOT NULL,       -- push, pull, squat, hinge, carry, isolation, core
    equipment TEXT,                        -- barbell, dumbbell, cable, machine, bodyweight
    is_compound BOOLEAN DEFAULT false,
    sport_specificity TEXT[],            -- ['padel_prevention', 'running_support'] etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout exercises (oefeningen binnen een workout)
CREATE TABLE workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_definition_id UUID NOT NULL REFERENCES exercise_definitions(id),
    exercise_order INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sets (individuele sets binnen een exercise)
CREATE TABLE workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_order INTEGER NOT NULL,
    set_type TEXT DEFAULT 'normal',       -- normal, warmup, dropset, failure
    weight_kg DECIMAL(6,2),
    reps INTEGER,
    distance_meters DECIMAL(8,1),         -- voor cardio exercises
    duration_seconds INTEGER,             -- voor timed exercises
    rpe DECIMAL(3,1),                     -- Rate of Perceived Exertion (1-10)
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Hardlopen & Padel tabellen

```sql
-- Hardloopsessies (vanuit Apple Health / Runna sync)
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    apple_health_id TEXT,                 -- Deduplicatie
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL,
    distance_meters DECIMAL(8,1) NOT NULL,
    avg_pace_seconds_per_km INTEGER,      -- Gemiddelde pace in sec/km
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories_burned DECIMAL(7,1),
    elevation_gain_meters DECIMAL(6,1),
    run_type TEXT DEFAULT 'easy',         -- easy, tempo, interval, long, race
    source TEXT NOT NULL DEFAULT 'apple_health',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, apple_health_id)
);

-- Padel sessies (vanuit Apple Health)
CREATE TABLE padel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    apple_health_id TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories_burned DECIMAL(7,1),
    intensity TEXT DEFAULT 'moderate',    -- light, moderate, high (afgeleid van HR)
    session_type TEXT DEFAULT 'match',   -- match, training, drill
    source TEXT NOT NULL DEFAULT 'apple_health',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, apple_health_id)
);
```

#### Dagelijkse activiteit

```sql
-- Dagelijkse activiteitsdata (vanuit Apple Health)
CREATE TABLE daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    date DATE NOT NULL,
    steps INTEGER,
    active_calories DECIMAL(7,1),
    total_calories DECIMAL(7,1),
    active_minutes INTEGER,
    stand_hours INTEGER,
    resting_heart_rate INTEGER,
    hrv_average DECIMAL(5,1),            -- Heart Rate Variability (ms)
    source TEXT DEFAULT 'apple_health',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
```

#### Voeding tabellen

```sql
-- Voedingslogs (natural language input + AI analyse)
CREATE TABLE nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    date DATE NOT NULL,
    time_of_day TIME,                     -- Wanneer gegeten
    raw_input TEXT NOT NULL,              -- "havermout met banaan en honing"
    estimated_calories DECIMAL(7,1),
    estimated_protein_g DECIMAL(5,1),
    estimated_carbs_g DECIMAL(5,1),
    estimated_fat_g DECIMAL(5,1),
    estimated_fiber_g DECIMAL(5,1),
    ai_analysis TEXT,                     -- Claude's volledige analyse
    confidence TEXT DEFAULT 'medium',     -- low, medium, high
    meal_type TEXT,                        -- breakfast, lunch, dinner, snack
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dagelijkse voeding samenvatting (berekend)
CREATE TABLE daily_nutrition_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    date DATE NOT NULL,
    total_calories DECIMAL(7,1),
    total_protein_g DECIMAL(5,1),
    total_carbs_g DECIMAL(5,1),
    total_fat_g DECIMAL(5,1),
    total_fiber_g DECIMAL(5,1),
    protein_target_g DECIMAL(5,1),       -- Berekend op basis van gewicht + activiteit
    calorie_target DECIMAL(7,1),         -- Berekend op basis van TDEE + activiteit die dag
    protein_status TEXT,                  -- under, on_track, over
    calorie_status TEXT,                  -- under, on_track, over
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
```

#### Schema & Doelen

```sql
-- Trainingsschema's
CREATE TABLE training_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,                   -- "Upper/Lower Split - Hypertrofie"
    description TEXT,
    schema_type TEXT NOT NULL,             -- upper_lower, push_pull_legs, full_body, custom
    start_date DATE NOT NULL,
    end_date DATE,                         -- NULL = nog actief
    is_active BOOLEAN DEFAULT true,
    weeks_planned INTEGER DEFAULT 4,
    current_week INTEGER DEFAULT 1,
    progression_rules JSONB,              -- {"bench_press": "+2.5kg per week", ...}
    workout_schedule JSONB NOT NULL,      -- Gedetailleerd schema per dag
    -- Voorbeeld workout_schedule:
    -- {
    --   "days": [
    --     {
    --       "day": "monday",
    --       "name": "Upper Body A",
    --       "exercises": [
    --         {"exercise_id": "...", "sets": 4, "reps": "6-8", "rest_seconds": 120},
    --         ...
    --       ]
    --     },
    --     ...
    --   ]
    -- }
    ai_generated BOOLEAN DEFAULT false,
    generation_context TEXT,              -- Context die gebruikt is om dit schema te genereren
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema block samenvattingen (voor context assembler)
CREATE TABLE schema_block_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    schema_id UUID NOT NULL REFERENCES training_schemas(id),
    summary TEXT NOT NULL,                -- "4 weken upper/lower, bench 60→67.5kg, squat stagneerde"
    exercises_used TEXT[],                -- Lijst oefeningen (voor variatie check)
    key_progressions JSONB,              -- {"bench_press": {"start": 60, "end": 67.5}, ...}
    adherence_percentage DECIMAL(5,1),
    total_sessions_planned INTEGER,
    total_sessions_completed INTEGER,
    end_reason TEXT,                       -- completed, time_up, injury, goal_reached, switched
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doelen
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,                   -- "Bench press 80kg"
    description TEXT,
    category TEXT NOT NULL,                -- strength, running, padel, nutrition, body_composition, general
    target_type TEXT NOT NULL,             -- numeric, boolean, habit
    target_value DECIMAL(10,2),           -- 80 (kg), 25 (minuten), etc.
    target_unit TEXT,                      -- kg, minutes, km, times_per_week
    current_value DECIMAL(10,2),
    deadline DATE,
    status TEXT DEFAULT 'active',          -- active, completed, paused, abandoned
    priority INTEGER DEFAULT 1,           -- 1 = highest
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

#### Blessure & Chat

```sql
-- Blessure logs
CREATE TABLE injury_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    date DATE NOT NULL,
    body_location TEXT NOT NULL,           -- shoulder_left, shoulder_right, knee_left, etc.
    description TEXT NOT NULL,             -- "Lichte pijn bij overhead press"
    severity TEXT DEFAULT 'mild',         -- mild, moderate, severe
    ai_analysis TEXT,                      -- Claude's analyse van mogelijke oorzaak
    ai_recommendations TEXT,              -- Claude's aanbevelingen
    related_workout_ids UUID[],           -- Workouts die mogelijk gerelateerd zijn
    status TEXT DEFAULT 'active',          -- active, monitoring, resolved
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat berichten
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    role TEXT NOT NULL,                    -- user, assistant
    content TEXT NOT NULL,
    message_type TEXT,                     -- general, injury_report, nutrition_log, schema_request, etc.
    context_used JSONB,                   -- Welke data de context assembler meestuurde (voor debugging)
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessies (groepering van berichten)
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT,                            -- Auto-generated of user-defined
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Aggregatie tabellen

```sql
-- Dagelijkse aggregatie
CREATE TABLE daily_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    date DATE NOT NULL,
    -- Training totalen
    total_training_minutes INTEGER DEFAULT 0,
    gym_minutes INTEGER DEFAULT 0,
    running_minutes INTEGER DEFAULT 0,
    padel_minutes INTEGER DEFAULT 0,
    -- Volume
    total_sets INTEGER DEFAULT 0,
    total_reps INTEGER DEFAULT 0,
    total_tonnage_kg DECIMAL(10,1) DEFAULT 0,  -- sets × reps × gewicht
    total_running_km DECIMAL(6,1) DEFAULT 0,
    -- Spiergroep belasting (genormaliseerd 0-100)
    muscle_load JSONB DEFAULT '{}',
    -- Voorbeeld: {"chest": 85, "back": 0, "shoulders": 60, "quads": 0, ...}
    -- Bewegingspatroon volume
    movement_pattern_volume JSONB DEFAULT '{}',
    -- Voorbeeld: {"push": 12, "pull": 0, "squat": 0, "hinge": 0} (totaal sets)
    -- Hart/herstel
    resting_heart_rate INTEGER,
    hrv DECIMAL(5,1),
    -- Computed
    training_load_score DECIMAL(5,1),     -- Gewogen score van alle training
    is_rest_day BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Wekelijkse aggregatie
CREATE TABLE weekly_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    week_start DATE NOT NULL,             -- Maandag van de week
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    -- Training totalen
    total_training_minutes INTEGER DEFAULT 0,
    gym_sessions INTEGER DEFAULT 0,
    running_sessions INTEGER DEFAULT 0,
    padel_sessions INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    -- Volume
    total_tonnage_kg DECIMAL(10,1) DEFAULT 0,
    total_running_km DECIMAL(6,1) DEFAULT 0,
    -- Spiergroep belasting (cumulatief over week)
    weekly_muscle_load JSONB DEFAULT '{}',
    -- Bewegingspatroon volume (cumulatief over week)
    weekly_movement_volume JSONB DEFAULT '{}',
    -- Workload ratio
    acute_load DECIMAL(7,1),              -- Gemiddelde daily load deze week
    chronic_load DECIMAL(7,1),            -- Gemiddelde daily load afgelopen 4 weken
    acute_chronic_ratio DECIMAL(4,2),     -- acute / chronic (ideaal: 0.8-1.3)
    workload_status TEXT,                  -- low, optimal, warning, danger
    -- Schema adherence
    planned_sessions INTEGER,
    completed_sessions INTEGER,
    adherence_percentage DECIMAL(5,1),
    -- Hart/herstel gemiddelden
    avg_resting_heart_rate DECIMAL(4,1),
    avg_hrv DECIMAL(5,1),
    -- Voeding gemiddelden
    avg_daily_calories DECIMAL(7,1),
    avg_daily_protein_g DECIMAL(5,1),
    -- Computed
    week_training_load_total DECIMAL(7,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Maandelijkse aggregatie
CREATE TABLE monthly_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    month INTEGER NOT NULL,               -- 1-12
    year INTEGER NOT NULL,
    -- Training totalen
    total_training_hours DECIMAL(5,1) DEFAULT 0,
    gym_sessions INTEGER DEFAULT 0,
    running_sessions INTEGER DEFAULT 0,
    padel_sessions INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    -- Volume
    total_tonnage_kg DECIMAL(12,1) DEFAULT 0,
    total_running_km DECIMAL(7,1) DEFAULT 0,
    -- Progressie highlights
    strength_highlights JSONB,            -- {"bench_press": {"start": 60, "end": 65}, ...}
    running_highlights JSONB,             -- {"avg_pace": 325, "longest_run_km": 12, ...}
    -- Personal records bereikt deze maand
    prs_achieved JSONB DEFAULT '[]',
    -- Gemiddelden
    avg_weekly_sessions DECIMAL(3,1),
    avg_weekly_tonnage DECIMAL(8,1),
    avg_weekly_km DECIMAL(5,1),
    avg_daily_calories DECIMAL(7,1),
    avg_daily_protein_g DECIMAL(5,1),
    -- Injuries
    injury_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

-- Personal Records
CREATE TABLE personal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    exercise_definition_id UUID REFERENCES exercise_definitions(id),
    record_type TEXT NOT NULL,             -- weight, reps, distance, pace, duration
    record_category TEXT NOT NULL,         -- e.g. "1rm", "5rm", "10rm" for lifting; "5k", "10k" for running
    value DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,                    -- kg, reps, seconds_per_km, km
    achieved_at TIMESTAMPTZ NOT NULL,
    workout_id UUID,                       -- Link naar workout waar PR behaald werd
    run_id UUID,                           -- Link naar run waar PR behaald werd
    previous_record DECIMAL(10,2),        -- Vorig record (voor delta)
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Indexen

```sql
-- Performance indexen
CREATE INDEX idx_workouts_user_date ON workouts(user_id, started_at DESC);
CREATE INDEX idx_runs_user_date ON runs(user_id, started_at DESC);
CREATE INDEX idx_padel_user_date ON padel_sessions(user_id, started_at DESC);
CREATE INDEX idx_daily_activity_user_date ON daily_activity(user_id, date DESC);
CREATE INDEX idx_daily_agg_user_date ON daily_aggregations(user_id, date DESC);
CREATE INDEX idx_weekly_agg_user_week ON weekly_aggregations(user_id, week_start DESC);
CREATE INDEX idx_monthly_agg_user_month ON monthly_aggregations(user_id, year DESC, month DESC);
CREATE INDEX idx_nutrition_logs_user_date ON nutrition_logs(user_id, date DESC);
CREATE INDEX idx_injury_logs_user_date ON injury_logs(user_id, date DESC);
CREATE INDEX idx_chat_messages_user_session ON chat_messages(user_id, created_at DESC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_schemas_user_active ON training_schemas(user_id, is_active);
CREATE INDEX idx_prs_user_exercise ON personal_records(user_id, exercise_definition_id, achieved_at DESC);
```

### 5.3 Row Level Security

```sql
-- Alle tabellen krijgen RLS met user_id filtering
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
-- ... (alle tabellen)

-- Voorbeeld policy
CREATE POLICY "Users can only access own data"
ON workouts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 6. Features: Gedetailleerde Specificaties

### 6.1 Dashboard (Home — Weekoverzicht)

**Route:** `/`
**Doel:** In één blik zien hoe je week eruitziet.

#### 6.1.1 Workload Meter

- **Visualisatie:** Semi-circulaire gauge meter (denk: snelheidsmeter)
- **Data:** `acute_chronic_ratio` uit `weekly_aggregations`
- **Zones:**
  - Groen (0.8 - 1.3): Optimaal
  - Geel (0.6 - 0.8 of 1.3 - 1.5): Aandacht
  - Rood (<0.6 of >1.5): Waarschuwing
- **Label:** "Training Load" met de ratio als getal (bijv. "1.12")
- **Subtekst:** "Je traint op schema" / "Iets meer dan gewoonlijk" / "Veel meer dan gewoonlijk — overweeg rust"

#### 6.1.2 Spiergroep Heatmap

- **Visualisatie:** Gestileerde body outline (voor + achter), spiergroepen kleuren op basis van belasting
- **Data:** `muscle_load` uit `daily_aggregations`, gecumuleerd over de week
- **Kleurschaal:** Transparant (0) → Lichtblauw (licht) → Blauw (matig) → Oranje (zwaar) → Rood (zeer zwaar)
- **Interactie:** Tap op spiergroep toont detail (welke oefeningen, hoeveel sets/volume)
- **Balans indicator:** Als een spiergroep significant meer belast is dan zijn tegenhanger (bijv. push >> pull), toon een kleine waarschuwingsicoon

#### 6.1.3 Sport Split

- **Visualisatie:** Drie horizontale bars of donut chart
- **Data:** `gym_minutes`, `running_minutes`, `padel_minutes` uit `daily_aggregations` (week totaal)
- **Per sport:** Sessies (getal) + totale duur
- **Target overlay:** Toon geplande sessies vs. gedane sessies per sport

#### 6.1.4 Adherence Tracker

- **Visualisatie:** 7 cirkels (Ma-Zo), elke cirkel toont:
  - Leeg = geen training gepland
  - Grijs outline = gepland maar niet gedaan
  - Gevuld (kleur per sport) = voltooid
  - Checkmark = voltooid conform schema
- **Data:** Vergelijk `training_schemas.workout_schedule` met daadwerkelijke workouts

#### 6.1.5 Training Block Indicator

- **Visualisatie:** Progressie bar met label
- **Data:** `training_schemas.current_week` / `training_schemas.weeks_planned`
- **Label:** "Week 3 van 4 — Opbouw" of "Deload week"
- **CTA:** "Bekijk schema" linkt naar schema detail

#### 6.1.6 Activity Rings (optioneel, als Apple Health data beschikbaar)

- **Visualisatie:** Apple-achtige ringen maar in Pulse styling
- **Data:** `steps`, `active_calories`, `active_minutes` uit `daily_activity`
- **Weergave:** Vandaag, met week-trend eronder

### 6.2 Progressie Tab

**Route:** `/progress`

#### 6.2.1 Strength per Bewegingspatroon

- **Visualisatie:** Line chart met meerdere lijnen (één per patroon)
- **Patronen:** Push, Pull, Squat, Hinge, (optioneel: Carry, Core)
- **Metric:** Estimated 1RM of totaal volume per patroon per week
- **Berekening estimated 1RM:** Epley formule: `weight × (1 + reps/30)`
- **Tijdsperiode:** 4 weken / 3 maanden / 6 maanden / 1 jaar (tabs)
- **Interactie:** Tap op datapunt toont de specifieke oefeningen en sets

#### 6.2.2 Running Progressie

- **Metrics:** Gemiddelde pace (sec/km), Totale km per week, Langste run
- **Visualisatie:** Combinatie chart — bars voor wekelijks volume, lijn voor pace
- **Bonus metric:** Pace bij vergelijkbare hartslag (cardiac efficiency). Bereken door runs te filteren op hart-slagzones en pace te vergelijken over tijd.
- **Tijdsperiode:** Zelfde tabs als strength

#### 6.2.3 Volume Trend

- **Visualisatie:** Stacked bar chart
- **Bars:** Wekelijks, gestapeld per sport (gym tonnage omgerekend naar "training load units", running km, padel uren)
- **Overlay:** Lijn met acute:chronic ratio trend

#### 6.2.4 Personal Records

- **Visualisatie:** Lijst met PR kaarten
- **Sortering:** Meest recent eerst
- **Per PR:** Oefening, waarde, datum, delta t.o.v. vorig record
- **Filter:** Per sport, per tijdsperiode
- **Celebratie:** Nieuwe PR's krijgen een highlight/badge de eerste week

#### 6.2.5 Goal Progress

- **Visualisatie:** Kaarten per actief doel
- **Per doel:** Titel, huidige waarde, target waarde, progressie bar, deadline (als gezet)
- **Trend:** Mini sparkline van voortgang over tijd

### 6.3 Voeding Tab

**Route:** `/nutrition`

#### 6.3.1 Voedingsinput

- **UI:** Tekstveld waar je in natural language intypt wat je hebt gegeten
- **Voorbeeld:** "Havermout met banaan en honing, daarna koffie met havermelk"
- **Flow:**
  1. User typt input
  2. POST naar `/api/nutrition/analyze`
  3. Claude schat macro's en calorieën
  4. Response wordt getoond als kaart: maaltijd + geschatte macro's
  5. Opgeslagen in `nutrition_logs`
  6. `daily_nutrition_summary` wordt herberekend
- **Maaltijd type:** Automatisch gedetecteerd op basis van tijd (ontbijt <10:00, lunch 10:00-15:00, diner 17:00-21:00, snack = rest), maar overrideable
- **Confidence indicator:** Klein label "geschat" met low/medium/high

#### 6.3.2 Dag Overzicht

- **Visualisatie:** Macro donut chart + lijst van maaltijden
- **Donut:** Eiwit (blauw), Koolhydraten (geel), Vet (rood) — met targets als buitenring
- **Eiwit tracker:** Prominente balk met huidige intake vs. target (bijv. "92g / 130g eiwit")
- **Calorie indicator:** "~1850 / ~2400 kcal" met status (onder/op schema/boven)
- **Maaltijdlijst:** Chronologisch, elke entry toont raw input + geschatte macro's

#### 6.3.3 Dag Status Indicator

- **Positie:** Bovenaan de voeding tab
- **Logica:**
  - Groen: eiwit op target, calorieën in range
  - Geel: eiwit onder target OF calorieën significant boven/onder
  - Rood: eiwit ver onder target EN calorieën ver onder/boven
- **Tekst:** Korte, menselijke samenvatting: "Je zit goed vandaag" of "Je mist nog ~40g eiwit"

### 6.4 Trends Tab

**Route:** `/trends`

#### 6.4.1 Maand Vergelijking

- **Visualisatie:** Side-by-side kaarten voor huidige maand vs. vorige maand
- **Metrics:** Totale sessies, tonnage, km, gemiddelde eiwit, blessures
- **Delta's:** Percentage stijging/daling per metric

#### 6.4.2 Kwartaal Vergelijking

- **Zelfde structuur als maand, maar over kwartalen
- **Extra:** Strength progressie highlights (beste lifts)

#### 6.4.3 "Een Jaar Geleden"

- **Visualisatie:** Kaart met snapshot van dezelfde week vorig jaar
- **Tekst:** "Een jaar geleden trainde je X keer per week, je bench press was Ykg, je liep Z km per week"
- **Vereiste:** Minimaal 1 jaar data (toont placeholder als niet beschikbaar)

### 6.5 Chat Agent

**Route:** `/chat` (full page) + MiniChat component (floating, beschikbaar op alle pagina's)

#### 6.5.1 Interface

- **Full page:** Chat interface vergelijkbaar met ChatGPT/Claude interface, maar met Pulse branding
- **MiniChat:** Floating action button rechtsonder → expandeert naar compact chat window
- **Berichten:** Markdown rendering, code blocks voor schema's, inline charts voor data
- **Suggesties:** Na het openen worden 3-4 contextual suggesties getoond:
  - Op zondag: "Hoe was mijn week?" / "Maak een nieuw schema"
  - Na een workout: "Analyseer mijn workout van vandaag"
  - Dagelijks: "Log wat ik heb gegeten" / "Hoe sta ik ervoor met mijn doelen?"

#### 6.5.2 Chat Agent System Prompt

De chat agent krijgt een uitgebreide system prompt die zijn rol, kennis, en beperkingen definieert:

```
Je bent Pulse Coach, een persoonlijke fitness- en voedingscoach geïntegreerd in het Pulse dashboard.

CONTEXT:
Je hebt toegang tot de trainingsdata, voedingslogs, doelen, en blessuregeschiedenis van de gebruiker. 
De relevante data wordt meegegeven in je context — gebruik deze als basis voor al je antwoorden.

ROL:
- Je bent een ervaren personal trainer en voedingscoach
- Je geeft evidence-based advies
- Je bent direct en eerlijk — geen vage algemeenheden
- Je refereert altijd aan de daadwerkelijke data van de gebruiker
- Je antwoordt in het Nederlands

CAPABILITIES:
1. Voedingsanalyse: Als de gebruiker beschrijft wat hij heeft gegeten, schat je macro's en calorieën.
   Geef altijd: geschatte calorieën, eiwit, koolhydraten, vet, en een kort oordeel.
2. Blessure-analyse: Als de gebruiker een blessure meldt, analyseer je recente trainingsdata 
   voor mogelijke oorzaken en geef je concrete aanbevelingen.
3. Schema-generatie: Als gevraagd, genereer je een nieuw trainingsschema. Varieer ten opzichte 
   van vorige schema's. Gebruik de progressie-data om realistische gewichten te kiezen.
4. Progress review: Vat de trainingsdata samen en geef inzichten.
5. Algemene coaching: Beantwoord vragen over training, voeding, herstel.

BEPERKINGEN:
- Je bent geen arts. Bij serieuze blessures of medische klachten, adviseer om een professional te raadplegen.
- Je voedingsschattingen zijn benaderingen, niet exact.
- Geef altijd aan wanneer je onzeker bent over iets.
```

#### 6.5.3 Vraag-type Classificatie

De backend classificeert elke gebruikersvraag voordat de context assembler wordt aangeroepen. Classificatie kan simpel met een prefix-match of een klein Claude-call:

| Vraag-type | Triggers | Context nodig |
|---|---|---|
| `nutrition_log` | "ik heb gegeten", "vandaag at ik", voedsel keywords | Voedingslogs vandaag, activiteit vandaag, profiel |
| `nutrition_question` | "honger", "wat moet ik eten", "hoeveel eiwit" | Voedingslogs vandaag, targets, activiteit |
| `injury_report` | "pijn", "last van", "blessure", lichaamsdeel keywords | Workouts 14d, spiergroep verdeling 4w, eerdere blessures, schema |
| `schema_request` | "nieuw schema", "trainingsschema", "wat moet ik trainen" | Huidige + vorige 3 schema's, progressie 3m, doelen, blessures |
| `progress_question` | "hoe gaat het", "mijn week", "vooruitgang", "progressie" | Relevante aggregaties, PRs, doelen |
| `weekly_review` | "weekoverzicht", "evaluatie", "terugblik" | Weekly agg, adherence, voeding gemiddelden, blessures |
| `general_chat` | Alles anders | Profiel, actieve doelen, huidig schema (light context) |

### 6.6 Doelen

**Route:** `/goals`

#### 6.6.1 Doel Types

| Category | Voorbeelden | Tracking |
|---|---|---|
| Strength | Bench press 80kg, Squat 100kg | Auto-tracked via workout data + e1RM |
| Running | 5k onder 25 min, 10k lopen | Auto-tracked via run data |
| Padel | 2x per week spelen | Auto-tracked via sessie frequentie |
| Nutrition | 130g eiwit per dag gemiddeld | Auto-tracked via voedingslogs |
| General | 4x per week trainen | Auto-tracked via alle trainingsdata |

#### 6.6.2 Goal UI

- **Aanmaken:** Via chat ("ik wil bench press 80kg halen voor juni") of via dedicated form
- **Overzicht:** Kaarten gesorteerd op prioriteit
- **Per kaart:** Titel, categorie badge, huidige waarde vs. target, voortgangsbalk, deadline indicator
- **Acties:** Pauzeren, aanpassen, voltooien, verwijderen

### 6.7 Instellingen

**Route:** `/settings`

- **Profiel:** Naam, gewicht, lengte, dieetvoorkeur
- **Koppelingen:** Hevy API key status, Health Auto Export status
- **Targets:** Eiwit per kg, wekelijkse training targets
- **Data:** Export alle data, verwijder account

---

## 7. UI/UX Specificaties

### 7.1 Design Systeem

**Stijl:** Data-heavy/sporty, geïnspireerd door Strava en Whoop

#### 7.1.1 Kleuren

```
// Achtergrond
--bg-primary: #0A0A0F        // Donker, bijna zwart
--bg-secondary: #12121A      // Iets lichter voor cards
--bg-tertiary: #1A1A2E       // Hover states, active states

// Tekst
--text-primary: #F0F0F5      // Wit-achtig
--text-secondary: #8888A0    // Muted
--text-tertiary: #55556A     // Zeer muted

// Accent
--accent-primary: #4F8CFF    // Blauw (primaire actie)
--accent-green: #34D399      // Groen (positief, op schema)
--accent-yellow: #FBBF24     // Geel (waarschuwing)
--accent-red: #F87171        // Rood (gevaar, onder target)
--accent-orange: #FB923C     // Oranje (aandacht)

// Sport kleuren
--sport-gym: #8B5CF6         // Paars
--sport-running: #06B6D4     // Cyaan
--sport-padel: #F59E0B       // Amber

// Spiergroep heatmap
--muscle-none: transparent
--muscle-light: #3B82F620
--muscle-moderate: #3B82F660
--muscle-heavy: #F59E0BA0
--muscle-very-heavy: #EF4444C0
```

#### 7.1.2 Typografie

```
// Font: Inter (via Google Fonts) of system font stack
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

// Sizes
--text-xs: 0.75rem     // Labels, badges
--text-sm: 0.875rem    // Secondary text, captions
--text-base: 1rem      // Body text
--text-lg: 1.125rem    // Sub-headers
--text-xl: 1.25rem     // Section headers
--text-2xl: 1.5rem     // Page headers
--text-3xl: 2rem       // Hero numbers (workload ratio, calorie total)
```

#### 7.1.3 Componenten

- **Cards:** Rounded corners (12px), subtle border (1px, #1A1A2E), geen shadow
- **Buttons:** Rounded (8px), primary = filled accent, secondary = outline
- **Inputs:** Dark background (#12121A), subtle border, focus ring accent-primary
- **Charts:** Gradient fills, rounded line caps, interactive tooltips
- **Navigation:** Bottom tab bar (mobiel, 5 items: Dashboard, Progressie, Voeding, Trends, Chat), Sidebar (desktop)

### 7.2 Responsive Breakpoints

```
Mobile first:
- < 640px: Single column, bottom nav, compact cards
- 640-1024px: 2 kolommen grid, bottom nav
- > 1024px: Sidebar navigatie, 3-4 kolommen grid, expanded charts
```

### 7.3 Mobile Prioriteiten

Op mobiel (primary use case):
1. Workload meter en spiergroep heatmap boven de fold
2. Quick-access floating chat button rechtsonder
3. Swipeable tabs voor Progressie/Voeding/Trends
4. Pull-to-refresh voor data sync
5. Compact voedingsinput die expand on focus

---

## 8. API Endpoints

### 8.1 Data Ingest

```
POST /api/ingest/apple-health
- Body: Health Auto Export JSON payload
- Auth: Bearer token (user_settings.health_auto_export_token)
- Verwerkt: activity, workouts (runs, padel), heart rate, HRV
- Response: { processed: number, errors: string[] }

POST /api/ingest/hevy/webhook
- Body: Hevy webhook payload
- Auth: Webhook secret verification
- Verwerkt: Nieuwe/bijgewerkte workouts
- Response: { ok: true }

POST /api/ingest/hevy/sync
- Auth: Supabase session
- Trigger: Handmatige sync of cron
- Verwerkt: Alle workouts sinds laatste sync
- Response: { synced: number, last_sync: timestamp }
```

### 8.2 Chat & AI

```
POST /api/chat
- Body: { message: string, session_id?: string }
- Auth: Supabase session
- Response: Streaming (text/event-stream)
- Side effects: Slaat berichten op, schrijft nutrition_logs/injury_logs indien relevant

POST /api/nutrition/analyze
- Body: { input: string, date?: string, time?: string }
- Auth: Supabase session
- Response: { calories, protein_g, carbs_g, fat_g, fiber_g, analysis, confidence }
- Side effect: Slaat op in nutrition_logs, herberekent daily_nutrition_summary

POST /api/schema/generate
- Body: { preferences?: object }
- Auth: Supabase session
- Response: { schema: TrainingSchema }
- Side effect: Slaat op in training_schemas (na user confirmation)
```

### 8.3 Aggregaties

```
POST /api/aggregations/compute
- Body: { type: 'daily' | 'weekly' | 'monthly', date?: string }
- Auth: Supabase session of Vercel Cron secret
- Herberekent de relevante aggregatie
- Response: { computed: true, period: string }
```

### 8.4 Cron Jobs

```
GET /api/cron/hevy-sync
- Schedule: Elke 15 minuten
- Synct nieuwe Hevy workouts

GET /api/cron/daily-aggregate
- Schedule: Elke nacht om 02:00
- Berekent dagelijkse aggregaties voor gisteren
- Berekent wekelijkse aggregatie als het maandag is
- Berekent maandelijkse aggregatie als het de 1e is

GET /api/cron/weekly-aggregate
- Schedule: Elke maandag om 03:00
- Herberekent wekelijkse aggregatie voor vorige week
- Update acute:chronic ratio
```

---

## 9. Exercise → Muscle Group Mapping

Dit is een kritiek onderdeel. Elke Hevy exercise moet gemapt worden naar spiergroepen en bewegingspatronen.

### 9.1 Mapping Structuur

```typescript
interface ExerciseMapping {
  hevyName: string;                    // Naam zoals in Hevy
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups: MuscleGroup[];
  movementPattern: MovementPattern;
  isCompound: boolean;
  equipment: Equipment;
}

type MuscleGroup =
  | 'chest' | 'upper_back' | 'lats' | 'shoulders'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'core' | 'hip_flexors' | 'rotator_cuff';

type MovementPattern =
  | 'horizontal_push' | 'vertical_push'
  | 'horizontal_pull' | 'vertical_pull'
  | 'squat' | 'hinge' | 'lunge'
  | 'carry' | 'isolation' | 'core';
```

### 9.2 Seed Data (Eerste ~50 veelvoorkomende exercises)

De seed data moet de meest voorkomende exercises bevatten. Bij sync met Hevy worden onbekende exercises gelogd voor handmatige mapping.

```typescript
const EXERCISE_MAPPINGS: ExerciseMapping[] = [
  // --- PUSH ---
  { hevyName: "Bench Press (Barbell)", primaryMuscleGroup: "chest", secondaryMuscleGroups: ["triceps", "shoulders"], movementPattern: "horizontal_push", isCompound: true, equipment: "barbell" },
  { hevyName: "Incline Bench Press (Barbell)", primaryMuscleGroup: "chest", secondaryMuscleGroups: ["triceps", "shoulders"], movementPattern: "horizontal_push", isCompound: true, equipment: "barbell" },
  { hevyName: "Dumbbell Bench Press", primaryMuscleGroup: "chest", secondaryMuscleGroups: ["triceps", "shoulders"], movementPattern: "horizontal_push", isCompound: true, equipment: "dumbbell" },
  { hevyName: "Overhead Press (Barbell)", primaryMuscleGroup: "shoulders", secondaryMuscleGroups: ["triceps", "core"], movementPattern: "vertical_push", isCompound: true, equipment: "barbell" },
  { hevyName: "Dumbbell Shoulder Press", primaryMuscleGroup: "shoulders", secondaryMuscleGroups: ["triceps"], movementPattern: "vertical_push", isCompound: true, equipment: "dumbbell" },
  { hevyName: "Dips", primaryMuscleGroup: "chest", secondaryMuscleGroups: ["triceps", "shoulders"], movementPattern: "vertical_push", isCompound: true, equipment: "bodyweight" },
  { hevyName: "Tricep Pushdown", primaryMuscleGroup: "triceps", secondaryMuscleGroups: [], movementPattern: "isolation", isCompound: false, equipment: "cable" },
  { hevyName: "Lateral Raise (Dumbbell)", primaryMuscleGroup: "shoulders", secondaryMuscleGroups: [], movementPattern: "isolation", isCompound: false, equipment: "dumbbell" },
  { hevyName: "Cable Fly", primaryMuscleGroup: "chest", secondaryMuscleGroups: [], movementPattern: "isolation", isCompound: false, equipment: "cable" },

  // --- PULL ---
  { hevyName: "Barbell Row", primaryMuscleGroup: "upper_back", secondaryMuscleGroups: ["biceps", "lats"], movementPattern: "horizontal_pull", isCompound: true, equipment: "barbell" },
  { hevyName: "Dumbbell Row", primaryMuscleGroup: "upper_back", secondaryMuscleGroups: ["biceps", "lats"], movementPattern: "horizontal_pull", isCompound: true, equipment: "dumbbell" },
  { hevyName: "Cable Row", primaryMuscleGroup: "upper_back", secondaryMuscleGroups: ["biceps", "lats"], movementPattern: "horizontal_pull", isCompound: true, equipment: "cable" },
  { hevyName: "Pull Up", primaryMuscleGroup: "lats", secondaryMuscleGroups: ["biceps", "upper_back"], movementPattern: "vertical_pull", isCompound: true, equipment: "bodyweight" },
  { hevyName: "Lat Pulldown (Cable)", primaryMuscleGroup: "lats", secondaryMuscleGroups: ["biceps", "upper_back"], movementPattern: "vertical_pull", isCompound: true, equipment: "cable" },
  { hevyName: "Face Pull", primaryMuscleGroup: "rotator_cuff", secondaryMuscleGroups: ["shoulders", "upper_back"], movementPattern: "horizontal_pull", isCompound: false, equipment: "cable" },
  { hevyName: "Bicep Curl (Dumbbell)", primaryMuscleGroup: "biceps", secondaryMuscleGroups: ["forearms"], movementPattern: "isolation", isCompound: false, equipment: "dumbbell" },
  { hevyName: "Barbell Curl", primaryMuscleGroup: "biceps", secondaryMuscleGroups: ["forearms"], movementPattern: "isolation", isCompound: false, equipment: "barbell" },
  { hevyName: "Hammer Curl (Dumbbell)", primaryMuscleGroup: "biceps", secondaryMuscleGroups: ["forearms"], movementPattern: "isolation", isCompound: false, equipment: "dumbbell" },

  // --- SQUAT ---
  { hevyName: "Squat (Barbell)", primaryMuscleGroup: "quads", secondaryMuscleGroups: ["glutes", "hamstrings", "core"], movementPattern: "squat", isCompound: true, equipment: "barbell" },
  { hevyName: "Front Squat (Barbell)", primaryMuscleGroup: "quads", secondaryMuscleGroups: ["glutes", "core"], movementPattern: "squat", isCompound: true, equipment: "barbell" },
  { hevyName: "Leg Press", primaryMuscleGroup: "quads", secondaryMuscleGroups: ["glutes", "hamstrings"], movementPattern: "squat", isCompound: true, equipment: "machine" },
  { hevyName: "Goblet Squat", primaryMuscleGroup: "quads", secondaryMuscleGroups: ["glutes", "core"], movementPattern: "squat", isCompound: true, equipment: "dumbbell" },
  { hevyName: "Leg Extension (Machine)", primaryMuscleGroup: "quads", secondaryMuscleGroups: [], movementPattern: "isolation", isCompound: false, equipment: "machine" },

  // --- HINGE ---
  { hevyName: "Deadlift (Barbell)", primaryMuscleGroup: "hamstrings", secondaryMuscleGroups: ["glutes", "upper_back", "core"], movementPattern: "hinge", isCompound: true, equipment: "barbell" },
  { hevyName: "Romanian Deadlift (Barbell)", primaryMuscleGroup: "hamstrings", secondaryMuscleGroups: ["glutes"], movementPattern: "hinge", isCompound: true, equipment: "barbell" },
  { hevyName: "Romanian Deadlift (Dumbbell)", primaryMuscleGroup: "hamstrings", secondaryMuscleGroups: ["glutes"], movementPattern: "hinge", isCompound: true, equipment: "dumbbell" },
  { hevyName: "Hip Thrust (Barbell)", primaryMuscleGroup: "glutes", secondaryMuscleGroups: ["hamstrings"], movementPattern: "hinge", isCompound: true, equipment: "barbell" },
  { hevyName: "Leg Curl (Machine)", primaryMuscleGroup: "hamstrings", secondaryMuscleGroups: [], movementPattern: "isolation", isCompound: false, equipment: "machine" },

  // --- LUNGE ---
  { hevyName: "Bulgarian Split Squat", primaryMuscleGroup: "quads", secondaryMuscleGroups: ["glutes", "hamstrings"], movementPattern: "lunge", isCompound: true, equipment: "dumbbell" },
  { hevyName: "Lunges (Dumbbell)", primaryMuscleGroup: "quads", secondaryMuscleGroups: ["glutes", "hamstrings"], movementPattern: "lunge", isCompound: true, equipment: "dumbbell" },

  // --- CORE ---
  { hevyName: "Plank", primaryMuscleGroup: "core", secondaryMuscleGroups: [], movementPattern: "core", isCompound: false, equipment: "bodyweight" },
  { hevyName: "Cable Crunch", primaryMuscleGroup: "core", secondaryMuscleGroups: [], movementPattern: "core", isCompound: false, equipment: "cable" },
  { hevyName: "Hanging Leg Raise", primaryMuscleGroup: "core", secondaryMuscleGroups: ["hip_flexors"], movementPattern: "core", isCompound: false, equipment: "bodyweight" },
  { hevyName: "Ab Wheel Rollout", primaryMuscleGroup: "core", secondaryMuscleGroups: ["shoulders"], movementPattern: "core", isCompound: false, equipment: "bodyweight" },

  // --- CALVES ---
  { hevyName: "Calf Raise (Standing)", primaryMuscleGroup: "calves", secondaryMuscleGroups: [], movementPattern: "isolation", isCompound: false, equipment: "machine" },
  { hevyName: "Calf Raise (Seated)", primaryMuscleGroup: "calves", secondaryMuscleGroups: [], movementPattern: "isolation", isCompound: false, equipment: "machine" },
];
```

### 9.3 Spiergroep Belasting Berekening

```typescript
// Voor elke workout, bereken belasting per spiergroep
function calculateMuscleLoad(workout: Workout): Record<MuscleGroup, number> {
  const load: Record<MuscleGroup, number> = {};

  for (const exercise of workout.exercises) {
    const mapping = getExerciseMapping(exercise.name);
    const totalVolume = exercise.sets.reduce((sum, set) => {
      return sum + (set.weight_kg * set.reps);
    }, 0);

    // Primary muscle group krijgt 100% van het volume
    load[mapping.primaryMuscleGroup] = (load[mapping.primaryMuscleGroup] || 0) + totalVolume;

    // Secondary muscle groups krijgen 50% van het volume
    for (const secondary of mapping.secondaryMuscleGroups) {
      load[secondary] = (load[secondary] || 0) + (totalVolume * 0.5);
    }
  }

  // Normaliseer naar 0-100 schaal (relatief aan weekgemiddelde van de gebruiker)
  return normalizeToScale(load);
}
```

---

## 10. Deployment & DevOps

### 10.1 Omgevingen

| Omgeving | URL | Doel |
|---|---|---|
| Development | localhost:3000 | Lokale ontwikkeling |
| Preview | pulse-*.vercel.app | Automatische preview per PR |
| Production | pulse-app.vercel.app (of custom domein) | Live applicatie |

### 10.2 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Hevy
HEVY_WEBHOOK_SECRET=whsec_...

# Health Auto Export
HEALTH_EXPORT_AUTH_TOKEN=pulse_hat_...

# Vercel Cron
CRON_SECRET=...
```

### 10.3 CI/CD

- **Push to main:** Auto-deploy naar production via Vercel
- **Push to feature branch:** Preview deployment
- **Database migraties:** Via Supabase CLI (`supabase db push`)

---

## 11. Niet-functionele Eisen

### 11.1 Performance

- **Dashboard load:** < 2 seconden (gebruik SSR voor initiële data)
- **Chat response start:** < 1 seconde tot eerste token (streaming)
- **API ingest response:** < 500ms (asynchroon aggregatie herberekening)
- **Aggregatie berekening:** < 5 seconden per dag/week/maand

### 11.2 Security

- Alle data achter Supabase RLS (Row Level Security)
- API keys encrypted at rest in database
- Health Auto Export endpoint beveiligd met bearer token
- Hevy webhook verificatie via secret
- Geen PII in logs
- HTTPS only

### 11.3 Schaalbaarheid

- Database schema ondersteunt multi-user via `user_id` op elke tabel
- RLS policies klaar voor multi-tenant
- Supabase Auth voor gebruikersbeheer
- Aggregatie jobs per-user, paralleliseerbaar

---

## 12. Toekomstige Uitbreidingen (niet in v1)

- Push notificaties (via web push of native app wrapper)
- Sociale features (vergelijk met vrienden, groepschallenges)
- Slaap tracking integratie
- Garmin/Fitbit integratie
- Strava integratie
- Wearable dashboard (Apple Watch complication)
- AI-gegenereerde workout suggesties in Hevy-compatible format
- Automatische schema rotatie
- Foto progress tracking
- Supplement tracking
