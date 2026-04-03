# Weekly Check-in v1 — Design Spec

**Datum:** 3 april 2026
**Status:** Goedgekeurd door Stef
**Scope:** v1 kern (zonder Google Calendar integratie en planning-stap)

---

## Samenvatting

Een wekelijkse check-in flow waar Stef de afgelopen week afsluit en een coach-analyse krijgt. De flow is een guided UI in 3 stappen (Review, Analyse, Bevestig), geen chatgesprek. Het resultaat: een afgesloten weekreview met AI-coaching opgeslagen in de database.

**Wat v1 WEL doet:** weekdata tonen, AI-analyse genereren, handmatige toevoegingen (padel/InBody), opslaan in DB.
**Wat v1 NIET doet:** Google Calendar lezen/schrijven, weekplan genereren, gap detection, planning-stap.

---

## Architectuur

### Data Flow

```
Bestaande aggregatie-tabellen
  (weekly_aggregations, daily_aggregations, workouts, runs, padel_sessions, personal_records)
    |
    v
/api/check-in/review (GET) — verzamelt en structureert weekdata
    |
    v
/api/check-in/analyze (POST) — Claude Sonnet genereert coaching-analyse
    |
    v
/api/check-in/confirm (POST) — slaat review + InBody + coaching_memory op
    |
    v
Nieuwe tabellen: weekly_reviews, body_composition_logs
```

### Technische keuzes

- **Server Components** voor de check-in page layout
- **Client Components** voor de interactieve flow (stap-navigatie, formulieren, API calls)
- **SWR** voor data fetching in de review stap
- **Claude Sonnet** voor de analyse (niet Haiku — moet diepgang hebben)
- **Zod** voor validatie van alle API inputs

---

## Stories

### Fase 0: Database (blokkerend)

#### WC-001: Migratie `weekly_reviews`

**Tabel:** Exact zoals gespecificeerd in PLAN-WEEKLY-CHECKIN.md (Database sectie).

**Acceptatiecriteria:**
- Tabel aangemaakt met alle kolommen
- RLS policy: `auth.uid() = user_id`
- `UNIQUE(user_id, week_start)` constraint
- Types gegenereerd in `src/types/database.ts`

#### WC-002: Migratie `body_composition_logs`

**Tabel:** Exact zoals gespecificeerd in PLAN-WEEKLY-CHECKIN.md.

**Acceptatiecriteria:**
- Tabel aangemaakt met alle kolommen
- RLS policy: `auth.uid() = user_id`
- `UNIQUE(user_id, date, source)` constraint
- Types gegenereerd

---

### Fase 1: API's (parallel)

#### WC-003: `/api/check-in/review` (GET)

**Input:** Authenticated user, optioneel `?week_start=2026-03-30`

**Output:**
```typescript
interface CheckInReview {
  week: { start: string; end: string; number: number }
  sessions: { planned: number; completed: number }
  workouts: Array<{ title: string; date: string; duration_min: number; tonnage_kg: number }>
  runs: Array<{ date: string; distance_km: number; pace: string; duration_min: number }>
  padel: Array<{ date: string; duration_min: number; intensity: string }>
  nutrition: { avgCalories: number; avgProtein: number; proteinTarget: number; calorieTarget: number }
  sleep: { avgHours: number; worstDay: { date: string; hours: number } | null }
  highlights: Array<{ type: 'pr' | 'streak' | 'milestone'; description: string; value?: string }>
  previousReview: WeeklyReview | null
}
```

**Data bronnen:**
- `weekly_aggregations` — sessie counts, totalen
- `daily_aggregations` — sleep, daily stats
- `workouts` — gym sessie details
- `runs` — hardloopsessies
- `padel_sessions` — padel
- `daily_nutrition_summary` — voeding averages
- `personal_records` — PR's deze week
- `weekly_reviews` — vorige review

**Acceptatiecriteria:**
- Default = huidige week (ma-zo)
- Kan overridden worden met `?week_start=`
- Returns lege arrays als geen data beschikbaar
- Returns `previousReview` als die bestaat

#### WC-004: `/api/check-in/analyze` (POST)

**Input:**
```typescript
interface AnalyzeRequest {
  reviewData: CheckInReview
  manualAdditions?: Array<{
    type: 'padel' | 'inbody' | 'injury' | 'note'
    data: Record<string, unknown>
  }>
}
```

**Output:**
```typescript
interface AnalyzeResponse {
  summary: string        // 3-5 zinnen coaching tekst met echte cijfers
  keyInsights: string[]  // 2-4 bullet points
  focusNextWeek: string  // concrete tip
}
```

**Acceptatiecriteria:**
- Claude Sonnet call (niet Haiku)
- Dedicated system prompt in `src/lib/ai/prompts/checkin-analyze.ts`
- Haalt `coaching_memory` op voor persoonlijke context
- Max ~4000 tokens data-context
- Verwijst naar echte cijfers uit de review data, geen algemeenheden

#### WC-005: `/api/check-in/confirm` (POST)

**Input:**
```typescript
interface ConfirmRequest {
  week_start: string
  summary_text: string
  sessions_planned: number
  sessions_completed: number
  highlights: Array<{ type: string; description: string; value?: string }>
  manual_additions: Array<{ type: string; data: Record<string, unknown> }>
  inbody_data?: {
    weight_kg: number
    muscle_mass_kg: number
    fat_mass_kg: number
    fat_pct: number
    waist_cm?: number
  }
}
```

**Acceptatiecriteria:**
- Slaat `weekly_reviews` record op (upsert op user_id + week_start)
- Als InBody data → ook `body_composition_logs` record
- Slaat key insights op in `coaching_memory`
- Returns het aangemaakte/geüpdatete review object

#### WC-006: `/api/body-composition` (GET + POST)

**GET:** Returns body comp logs voor user, datum desc, `?limit=10`

**POST Input:**
```typescript
const bodyCompSchema = z.object({
  date: z.string().date(),
  source: z.enum(['inbody', 'manual', 'smart_scale']).default('inbody'),
  weight_kg: z.number().min(30).max(300),
  muscle_mass_kg: z.number().min(10).max(150).optional(),
  fat_mass_kg: z.number().min(0).max(150).optional(),
  fat_pct: z.number().min(0).max(80).optional(),
  waist_cm: z.number().min(40).max(200).optional(),
  notes: z.string().max(500).optional(),
})
```

**POST Output:** Opgeslagen record + delta's vs vorige meting

**Acceptatiecriteria:**
- Zod validatie op POST input
- Delta berekening tegen vorige meting van dezelfde source
- GET ondersteunt `?limit=` parameter

---

### Fase 2: UI

#### WC-007: Check-in Flow

**Route:** `/check-in`

**Componenten:**

| Component | Doel |
|-----------|------|
| `CheckInFlow.tsx` | Hoofd container, stap-state (1/2/3), navigatie |
| `WeekReviewCard.tsx` | Stap 1: toont review data, knoppen voor handmatige toevoegingen |
| `ManualAddModal.tsx` | Modal: padel toevoegen, InBody invullen, vrij tekstveld |
| `CoachAnalysisCard.tsx` | Stap 2: trigger analyse, toon resultaat met loading state |
| `ConfirmationCard.tsx` | Stap 3: samenvatting van alles, bevestig-knop |

**Flow:**
1. Pagina laadt → fetch `/api/check-in/review`
2. User ziet weekoverzicht, kan handmatig toevoegen
3. User klikt "Analyse" → POST `/api/check-in/analyze`
4. User ziet coaching tekst
5. User klikt "Bevestig" → POST `/api/check-in/confirm`
6. Success state met confetti of check icon, link naar home

**Acceptatiecriteria:**
- 3-staps flow met indicator bovenaan
- Terug-navigatie mogelijk
- Loading states (skeleton/spinner) tijdens API calls
- Error states bij API failures
- Mobile-first (375px), schaalt naar desktop
- Dark theme, Pulse design system (Tailwind)
- SWR voor review data fetching

---

### Fase 3: Integratie

#### WC-008: Homescreen Badge

**Acceptatiecriteria:**
- Badge verschijnt op za (6), zo (0), ma (1) als huidige week geen review heeft
- Check via GET naar `weekly_reviews` voor huidige week
- Tekst: "Week {X} afsluiten" met link naar `/check-in`
- Past in bestaande `DashboardPage` layout (boven de WeekAtAGlance)
- Verdwijnt zodra review is opgeslagen

---

## Uitvoeringsplan

### Subagent strategie (hybride)

```
Fase 0:  [===WC-001+002===]                    (1 agent, main branch)
                |
Fase 1:  [===WC-003→004→005===]  Track A       (1 agent, worktree)
         [===WC-006==========]  Track B         (1 agent, worktree, parallel)
                |
Fase 2:  [========WC-007=========]             (1 agent, na merge Fase 1)
                |
Fase 3:  [==WC-008==]                          (1 agent, klein)
```

### Skills per fase

| Fase | Skills | Waarom |
|------|--------|--------|
| 0 | — | Migraties zijn declaratief SQL, geen TDD nodig |
| 1 | `tdd` → `code-review` | API endpoints verdienen tests + review |
| 2 | `frontend-design` → `code-review` | UI design + kwaliteitscheck |
| 3 | `code-review` | Klein maar moet passen in bestaand dashboard |

### Review momenten

Na elke fase stopt de uitvoering voor review door Stef:
1. **Na Fase 0:** Tabellen correct? Types kloppen?
2. **Na Fase 1:** API responses logisch? Data compleet?
3. **Na Fase 2:** UI flow prettig? Design goed?
4. **Na Fase 3:** Badge werkt? Timing klopt?

---

## v1.1 Backlog

Zie PLAN-WEEKLY-CHECKIN.md voor de volledige v1.1 backlog met afhankelijkheden.

Samenvatting van wat bewust is uitgesteld:
- **Google Calendar integratie** (lezen + schrijven) — WC-101 t/m WC-104
- **Gap detection** (niet-gelogde sessies herkennen) — WC-105
- **Planning-stap** (weekplan voorstel + aanpassen) — WC-103, WC-106, WC-108
- **Check-in historie** (overzicht van vorige check-ins) — WC-107
