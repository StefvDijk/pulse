# Plan: Weekly Check-in — Wekelijkse Review & Planning

**Datum:** 3 april 2026
**Status:** v1 COMPLEET (3 april 2026) — kern zonder Calendar-integratie. Zie v1.1 backlog voor uitgestelde features.
**Afhankelijkheden:** Homescreen redesign (voor badge integratie)

---

## Samenvatting

Elke week (typisch zondagavond) sluit je de afgelopen week af en plant de volgende. Dit is geen chatgesprek maar een **guided flow in een dedicated UI** — de coach analyseert, jij bevestigt en vult aan. Het resultaat: een afgesloten weekreview en een weekplanning die in je Google Calendar staat.

---

## De Flow

### Fase 1: Week Review (terugkijken)

**Automatisch gegenereerd** op basis van Pulse data (workouts, runs, padel, voeding, slaap).

**Inhoud:**
- Overzicht van alle sessies: gepland vs gedaan, met tijden en duur
- Highlights: PR's, opvallende progressie, streaks
- Aandachtspunten: gemiddeld eiwit vs target, slaap gemiddelde
- Gap detectie: sessies die waarschijnlijk niet gelogd zijn
  - Padel op maandagavond is vast → als er geen log is, vraag: "Heb je padel gespeeld?"
  - Hardlopen gepland maar niet gelogd → vraag
  - Detectie op basis van: schema zegt workout, geen matching workout in DB

**Handmatige toevoegingen:**
- "Padel handmatig toevoegen" → duur, intensiteit (zonder horloge)
- "InBody scan toevoegen" → formulier: gewicht, spiermassa, vetmassa, vetpercentage, buikomtrek
  - Automatisch vergelijken met vorige scan en delta's tonen
- "Blessure melden" → bestaande injury_log flow
- "Iets anders toevoegen" → vrij tekstveld dat de agent verwerkt

**Data nodig:**
- `workouts` tabel (Hevy sync) — gym sessies
- `runs` tabel — hardloopsessies
- `padel_sessions` tabel — padel
- `nutrition_logs` / `daily_nutrition_summary` — voeding
- `sleep_logs` — slaap
- `daily_activity` — stappen, HR, HRV
- `personal_records` — PR's deze week
- `training_schemas` → `workout_schedule` — wat was gepland

---

### Fase 2: Coach Analyse (AI-gegenereerd)

**Eén AI-call** die de weekdata samenvat in een persoonlijke analyse.

**Input voor de agent:**
- Alle data uit Fase 1 (gestructureerd, niet raw)
- Handmatige toevoegingen
- Context: blessures, doelen, schema-week, vorige week's review

**Output:** 3-5 zinnen coaching tekst. Concreet, met echte cijfers, geen algemeenheden.

**Voorbeelden:**
- "Sterke week. Alle 4 gym sessies gedaan en je lat pulldown PR (42.5kg) brengt je doel van 45kg dichterbij — nog 2.5kg te gaan."
- "Eiwit zat gemiddeld op 131g/dag, 9g onder target. Structureel probleem: weekenddagen zijn het zwakke punt (gem 105g za/zo). Tip: plan een extra portie kwark of skyr op weekend-ochtenden."
- "Je slaap was goed deze week (gem 7u18m), maar woensdag was een uitschieter (5u42m). Dat verklaart je lagere energie op donderdag."

**Model:** Sonnet (niet Haiku — dit moet diepgang hebben)

---

### Fase 3: Vooruitkijken (Agenda lezen + plannen)

**Google Calendar integratie:**

1. **Lezen**: Haal events op voor komende week (ma t/m zo)
   - Kantoor-events → detecteer kantoor-dagen (fietsen 14km)
   - Weekend-trips → detecteer "niet beschikbaar" periodes
   - Sociale events → detecteer avonden die training blokkeren
   - Bestaande Pulse workout-events → detecteer al ingeplande sessies

2. **Conflict detectie**: Agent analyseert agenda en identificeert:
   - Dagen die niet beschikbaar zijn voor training
   - Drukke avonden (borrels, dinners) → hardlopen/padel lastig
   - Reisdagen → geen gym toegang

3. **Voorstel genereren**: Agent stelt een weekplanning voor
   - Past het schema (Upper A, Lower A, Upper B, Lower B) in op beschikbare dagen
   - Hardlopen op een logisch moment
   - Padel op maandagavond (vast)
   - Houdt rekening met: geen 2 zware legdays achter elkaar, BSS niet na intervals, etc.
   - Tijdsloten: 06:30-07:30 voor ochtendtraining, avond voor padel

4. **Aanpassen**: Gebruiker kan het voorstel tweaken
   - Dag verschuiven
   - Workout wisselen
   - Tijdslot aanpassen
   - "Ik wil deze week maar 3x trainen" → agent past aan

---

### Fase 4: Bevestigen & Inplannen

**Acties bij bevestiging:**

1. **Google Calendar schrijven:**
   - Workouts als events (titel: "💪 Upper A", locatie: "Train More, Piet Heinkade")
   - Hardlopen als event (titel: "🏃 Hardlopen")
   - Padel als event (titel: "🎾 Padel", locatie indien bekend)
   - Tijden uit het bevestigde plan

2. **Pulse DB updaten:**
   - `scheduled_overrides` updaten voor afwijkingen van het standaard schema
   - `weekly_reviews` record aanmaken met:
     - Week nummer + datumbereik
     - Samenvatting (AI-tekst)
     - Geplande sessies volgende week
     - Handmatige toevoegingen
     - InBody data (als toegevoegd)

3. **Coaching memory updaten:**
   - Relevante inzichten opslaan voor toekomstige context
   - "Stef had een druk weekend in week 4 en trainde 4x ma-do — dat werkte goed"

---

## UI Design

### Route: `/check-in`

**Layout:** Verticale stappen-flow, niet een chat. Elke stap is een kaart die je kunt bevestigen en doorgaan.

```
┌── Stap indicator ──────────────────────┐
│  ① Review  →  ② Analyse  →  ③ Plan    │
└────────────────────────────────────────┘

┌── Content kaart ───────────────────────┐
│                                        │
│  [Inhoud per stap — zie flow boven]    │
│                                        │
│  [Actie knoppen]                       │
└────────────────────────────────────────┘
```

**Stijl:** Volgt het Pulse design system (licht, warm, Mineral palet). Cards met subtiele borders, geen schaduwen. Typografie doet het werk.

**Responsive:** iPhone-first (375px), schaalt naar desktop.

---

## Database

### Nieuwe tabel: `weekly_reviews`

```sql
CREATE TABLE weekly_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Review data
  summary_text TEXT,                    -- AI-gegenereerde samenvatting
  sessions_planned INTEGER,
  sessions_completed INTEGER,
  highlights JSONB DEFAULT '[]',        -- [{type: "pr", exercise: "Lat Pulldown", value: "42.5kg"}]
  manual_additions JSONB DEFAULT '[]',  -- [{type: "padel", duration_min: 60, notes: "zonder horloge"}]
  
  -- InBody data (als toegevoegd tijdens check-in)
  inbody_weight_kg NUMERIC(5,2),
  inbody_muscle_mass_kg NUMERIC(5,2),
  inbody_fat_mass_kg NUMERIC(5,2),
  inbody_fat_pct NUMERIC(4,1),
  inbody_waist_cm NUMERIC(5,1),
  
  -- Planning
  next_week_plan JSONB,                 -- [{day: "monday", workout: "Upper A", time: "06:30"}]
  calendar_synced BOOLEAN DEFAULT FALSE,
  
  -- Meta
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reviews"
  ON weekly_reviews FOR ALL
  USING (auth.uid() = user_id);
```

### InBody data opslag

InBody scans worden opgeslagen in `weekly_reviews` (als onderdeel van de check-in) EN als losse entries in een `body_composition_logs` tabel voor historische tracking:

```sql
CREATE TABLE body_composition_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  source TEXT DEFAULT 'inbody',         -- 'inbody', 'manual', 'smart_scale'
  weight_kg NUMERIC(5,2),
  muscle_mass_kg NUMERIC(5,2),
  fat_mass_kg NUMERIC(5,2),
  fat_pct NUMERIC(4,1),
  bmi NUMERIC(4,1),
  waist_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  arm_right_cm NUMERIC(5,1),
  thigh_right_cm NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, date, source)
);

ALTER TABLE body_composition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own body comp logs"
  ON body_composition_logs FOR ALL
  USING (auth.uid() = user_id);
```

---

## Google Calendar Integratie

### Wat er al is
- `google_calendar_tokens` tabel (refresh tokens)
- `src/lib/google/` directory (basis client)
- Google Calendar OAuth flow in settings

### Wat erbij moet

**Lezen:**
- `listEvents(userId, startDate, endDate)` — Haal events op voor een datumbereik
- Parse events naar een simplified formaat: `{title, start, end, location, allDay}`
- Detecteer patronen: "kantoor", "borrel", "weekend weg", etc.

**Schrijven:**
- `createEvent(userId, event)` — Maak een workout event aan
- `updateEvent(userId, eventId, event)` — Update een bestaand event
- `deleteEvent(userId, eventId)` — Verwijder een event
- Event formaat: titel, start/eindtijd, locatie, beschrijving, kleur
- **Event IDs opslaan** in Pulse DB zodat we events later kunnen updaten/verwijderen

**Conflict handling:**
- Workout event bestaat al → update ipv duplicate aanmaken
- Gebruiker verwijdert event in Google Calendar → Pulse detecteert dit bij volgende sync

---

## API Endpoints

| Endpoint | Method | Doel |
|----------|--------|------|
| `/api/check-in/review` | GET | Genereer week review (data + gap detection) |
| `/api/check-in/analyze` | POST | AI-analyse van de week (met handmatige toevoegingen) |
| `/api/check-in/plan` | POST | Genereer weekplan voorstel (leest Google Calendar) |
| `/api/check-in/confirm` | POST | Bevestig plan (schrijf naar Calendar + DB) |
| `/api/check-in/history` | GET | Lijst van vorige check-ins |
| `/api/body-composition` | POST | InBody data opslaan |
| `/api/body-composition` | GET | InBody historie ophalen |
| `/api/calendar/events` | GET | Google Calendar events lezen |
| `/api/calendar/events` | POST | Google Calendar event aanmaken |

---

## Implementatie — v1 Stories

> **Aanpak:** Hybride — DB eerst (blokkerend), dan API's parallel, UI als laatste.
> **Scope v1:** Kern check-in flow zonder Google Calendar lees/schrijf-integratie en zonder planning-stap.
> Flow = Review → Coach Analyse → Bevestig & Opslaan.

### Fase 0: Database (blokkerend)

**WC-001: Migratie `weekly_reviews` tabel** (1073f00)
- [x] Tabel aangemaakt met alle kolommen zoals gespecificeerd in DB sectie
- [x] RLS policy: users zien alleen eigen reviews
- [x] `UNIQUE(user_id, week_start)` constraint
- [x] Types gegenereerd en beschikbaar in `database.ts`

**WC-002: Migratie `body_composition_logs` tabel** (5b90f2f)
- [x] Tabel aangemaakt met alle kolommen
- [x] RLS policy actief
- [x] `UNIQUE(user_id, date, source)` constraint
- [x] Types gegenereerd

### Fase 1: API's (parallel — Track A + Track B)

**Track A — Check-in endpoints:**

**WC-003: `/api/check-in/review` (GET)** (f90c2c5)
- [x] Input: authenticated user, optioneel `?week_start=2026-03-30`
- [x] Output: week overview met sessions (planned/completed), workouts, runs, padel, nutrition (avg cal/protein vs target), sleep (avg hours, worst day), highlights (PR's), previousReview
- [x] Haalt data uit `weekly_aggregations`, `daily_aggregations`, `workouts`, `runs`, `padel_sessions`, `personal_records`
- [x] Default = huidige week

**WC-004: `/api/check-in/analyze` (POST)** (b1e505a)
- [x] Input: review data + handmatige toevoegingen
- [x] Output: `{ summary: string, keyInsights: string[], focusNextWeek: string }`
- [x] Claude Sonnet call met specifieke week-analyse system prompt
- [x] Verwijst naar echte cijfers, geen algemeenheden
- [x] Haalt `coaching_memory` op voor context
- [x] Max ~4000 tokens input

**WC-005: `/api/check-in/confirm` (POST)** (bf0f240)
- [x] Slaat `weekly_reviews` record op
- [x] Als InBody data meegegeven: ook `body_composition_logs` record
- [x] Slaat relevante inzichten op in `coaching_memory`
- [x] Duplicate check: als review voor die week al bestaat → update
- [x] Returns het aangemaakte/geüpdatete review object

**Track B — Body composition:**

**WC-006: `/api/body-composition` (GET + POST)** (05aa3cd)
- [x] GET: alle body comp logs voor user, datum desc, `?limit=10`
- [x] POST: Zod validatie, sla op, return delta's vs vorige meting
- [x] Delta: `{ weight: +0.3, muscle: +0.2, fat: -0.1, fatPct: -0.3 }`

### Fase 2: UI

**WC-007: Check-in Flow UI** (3782ebe)
- [x] `/check-in` page route
- [x] `CheckInFlow.tsx` — hoofd container, 3-staps state management
- [x] `WeekReviewCard.tsx` — toont review data, handmatige toevoeg-knoppen
- [x] `ManualAddModal.tsx` — modal voor padel/InBody/vrij tekst toevoegen
- [x] `CoachAnalysisCard.tsx` — toont AI analyse met loading state
- [x] `ConfirmationCard.tsx` — samenvatting + bevestig-knop
- [x] Stap-indicator bovenaan (Review → Analyse → Bevestig)
- [x] Terug-navigatie mogelijk
- [x] Loading states tijdens API calls
- [x] Na bevestiging: success state met link naar home
- [x] Mobile-first, Pulse design system (Mineral Light)

### Fase 3: Integratie

**WC-008: Homescreen Badge** (46f799f)
- [x] Badge verschijnt op za/zo/ma als huidige week geen review heeft
- [x] Tekst: "Week X afsluiten" met link naar `/check-in`
- [x] Past in bestaande `DashboardPage` layout (boven ReadinessSignal)
- [x] Verdwijnt na check-in (checkt via `/api/check-in/status`)

---

## v1.1 Backlog (bewust uitgesteld)

| ID | Feature | Reden uitgesteld | Afhankelijk van |
|----|---------|-----------------|-----------------|
| ~~WC-101~~ | ~~Google Calendar lezen (`listEvents`)~~ | **DONE** (cd606d0) — `listEvents` + OAuth token refresh | — |
| ~~WC-102~~ | ~~Agenda conflict detectie~~ | **DONE** (11d6c24) — pure `analyzeConflicts` functie | WC-101 |
| ~~WC-103~~ | ~~Weekplan voorstel genereren~~ | **DONE** (3b49f53) — AI plan generator + hooks + UI | WC-101, WC-102 |
| ~~WC-104~~ | ~~Google Calendar events schrijven bij confirm~~ | **DONE** (a22553e) — fire-and-forget sync bij confirm | WC-103 |
| ~~WC-105~~ | ~~Gap detection (niet-gelogde sessies)~~ | **DONE** (69cd699) — detecteert gemiste gym/padel/run sessies | — |
| ~~WC-106~~ | ~~`scheduled_overrides` updaten bij confirm~~ | **DONE** (42d4e66) — merge overrides op active schema | WC-103 |
| ~~WC-107~~ | ~~Check-in historie pagina~~ | **DONE** (24772a4) — `/check-in/history` met API + UI | — |
| ~~WC-108~~ | ~~Weekplan aanpassen (dag verschuiven, workout wisselen)~~ | **DONE** (e1573e3) — Planning stap 3 met editable weekplan UI | WC-103 |

---

## Oorspronkelijke implementatiestappen (referentie)

<details>
<summary>Klik om de originele stappen te zien (voor/na vergelijking)</summary>

### Stap 1: Database (klein)
- Migration: `weekly_reviews` tabel
- Migration: `body_composition_logs` tabel
- Types genereren

### Stap 2: Google Calendar read/write (medium) → **uitgesteld naar v1.1**
- `src/lib/google/calendar.ts` — listEvents, createEvent, updateEvent
- `/api/calendar/events` GET/POST endpoints
- Testen met echte Google Calendar

### Stap 3: Check-in API (medium)
- `/api/check-in/review` — data verzamelen + gap detection
- `/api/check-in/analyze` — AI-call voor coach analyse
- `/api/check-in/plan` — weekplan genereren met agenda-context → **uitgesteld naar v1.1**
- `/api/check-in/confirm` — plan bevestigen en opslaan

### Stap 4: Check-in UI (medium-groot)
- `/check-in` page route
- `CheckInFlow.tsx` — hoofd component met stap-navigatie
- `WeekReviewCard.tsx` — stap 1: review overzicht
- `ManualAddModal.tsx` — padel/InBody/blessure toevoegen
- `CoachAnalysisCard.tsx` — stap 2: AI analyse
- `WeekPlanCard.tsx` — stap 3: voorstel + agenda preview → **uitgesteld naar v1.1**
- `ConfirmationCard.tsx` — stap 4: bevestiging

### Stap 5: Homescreen integratie (klein)
- Badge/nudge op homescreen
- Conditie: weekend + geen review
- Link naar `/check-in`

### Stap 6: InBody integratie (klein)
- `/api/body-composition` endpoint
- InBody formulier component
- Vergelijking met vorige scan
- Integratie in Progressie pagina (later) → **uitgesteld naar v1.1**

</details>

---

## Niet in scope (v1)

- Push notifications / reminders (vereist PWA)
- Automatische gap detection voor fietsen (wordt al gelogd via Apple Health)
- Meerdere agenda's kiezen (één default Google Calendar)
- Recurring events aanmaken (elke week opnieuw via check-in)
- Voice input voor handmatige toevoegingen
- Foto-upload voor InBody scan (handmatig invullen)
