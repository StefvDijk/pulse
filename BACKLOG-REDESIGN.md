# BACKLOG-REDESIGN.md — Pulse UX Redesign

## Aanpak

Elke story is een kleine, testbare taak. Een story is pas af als:
1. De code werkt
2. De testcase(s) slagen (Playwright E2E of API-test)
3. Commit + deploy

**Omvang:** XS (<30 min) | S (30-60 min) | M (1-2 uur) | L (2-4 uur)

**Status:** `[ ]` To do | `[~]` In progress | `[x]` Done

---

## Epic R0: Test Infrastructure

### `R-001` — Playwright installeren en eerste smoke test
**Omvang:** S
**Beschrijving:** Installeer Playwright, configureer voor de Pulse app, schrijf een basis smoke test.
**Testcases:**
- [ ] `npx playwright test` draait zonder errors
- [ ] Smoke test: homepage laadt en toont navigatie met 5 tabs
**Acceptatiecriteria:**
- [ ] `playwright.config.ts` aanwezig met baseURL `http://localhost:3000`
- [ ] `tests/` directory met minimaal 1 werkende test
- [ ] `pnpm test:e2e` script in package.json

---

## Epic R1: Dashboard Cleanup

### `R-002` — Verwijder MuscleHeatmap SVG van dashboard
**Omvang:** XS
**Beschrijving:** Verwijder de spiergroep-heatmap (voor/achter SVG lichaam) van het dashboard. Het component mag blijven bestaan maar wordt niet meer gerenderd.
**Testcases:**
- [ ] Dashboard pagina bevat geen SVG body silhouette
- [ ] Dashboard pagina bevat geen tekst "Spiergroepbelasting"
- [ ] Dashboard laadt zonder errors
**Acceptatiecriteria:**
- [ ] MuscleHeatmap niet meer geïmporteerd in DashboardPage.tsx
- [ ] Geen visuele regressie op overige dashboard cards

### `R-003` — Verwijder SportSplit en WorkloadMeter van dashboard
**Omvang:** XS
**Beschrijving:** Verwijder de sport-verdeling bars en de workload ratio gauge. De workload ratio is een advanced metric die niet thuishoort op de hoofdpagina.
**Testcases:**
- [ ] Dashboard bevat geen tekst "Sport verdeling"
- [ ] Dashboard bevat geen tekst "Workload ratio"
- [ ] Dashboard bevat geen gauge/meter SVG element
- [ ] Dashboard laadt zonder errors
**Acceptatiecriteria:**
- [ ] SportSplit en WorkloadMeter niet meer geïmporteerd in DashboardPage.tsx
- [ ] Adherence tracker en stats blijven zichtbaar

### `R-004` — Verwijder Trends pagina
**Omvang:** XS
**Beschrijving:** De Trends pagina toont data-analist views die niet nuttig zijn voor de gebruiker. Verwijder de route en navigatie-link.
**Testcases:**
- [ ] `/trends` route geeft 404 of redirect naar home
- [ ] Navigatie bevat geen "Trends" link
**Acceptatiecriteria:**
- [ ] Route `/trends` verwijderd
- [ ] Navigatie bijgewerkt

### `R-005` — Vereenvoudig navigatie naar 4 tabs
**Omvang:** S
**Beschrijving:** Wijzig de navigatie van 5 tabs naar 4: Home, Schema, Progressie, Coach. Voeding wordt onderdeel van de coach (write-backs bestaan al). Goals wordt onderdeel van schema.
**Testcases:**
- [ ] Navigatie toont exact 4 tabs: "Home", "Schema", "Progressie", "Coach"
- [ ] Elke tab navigeert naar de juiste pagina (`/`, `/schema`, `/progress`, `/chat`)
- [ ] Mobiele bottom-nav toont 4 items
- [ ] Desktop sidebar toont 4 items + settings
**Acceptatiecriteria:**
- [ ] Navigation.tsx bijgewerkt met 4 items
- [ ] Voeding en Goals routes blijven bereikbaar maar niet in de nav

---

## Epic R2: Schema API & Data

### `R-006` — Workout-dag mapping configuratie
**Omvang:** S
**Beschrijving:** Creëer een configuratie die weekdagen mapt naar workout titels op basis van het huidige schema. Dit is de basis voor "wat doe ik vandaag?" en het schema-overzicht.

Mapping voor het huidige schema:
- Maandag → "Upper A" (Push Focus)
- Dinsdag → "Lower A" (Quad Focus)
- Woensdag → "Upper B" (Pull Focus)
- Donderdag → "Lower B" (Hinge Focus)
- Vrijdag → "Hardlopen"
- Zaterdag/Zondag → Rust

Dit moet configureerbaar zijn (opgeslagen in training_schemas of user_settings).
**Testcases:**
- [ ] API `GET /api/schema/week` returned een array van 7 dagen met workout naam en type
- [ ] Maandag returned `{ day: "ma", workout: "Upper A", type: "gym" }`
- [ ] Zaterdag returned `{ day: "za", workout: null, type: "rest" }`
**Acceptatiecriteria:**
- [ ] Mapping opgeslagen in database (user_settings of training_schemas)
- [ ] API endpoint retourneert weekschema

### `R-007` — API endpoint: huidige week met workouts en oefeningen
**Omvang:** M
**Beschrijving:** Creëer `GET /api/schema/week` dat retourneert:
- De 7 dagen van de huidige week
- Per dag: geplande workout naam + of het gedaan is (match op Hevy workout title + datum)
- Per gedane workout: de oefeningen met sets/reps/gewicht
- Per geplande workout: de oefeningen van de laatste keer dat deze workout gedaan is (als referentie)
**Testcases:**
- [ ] Response bevat 7 dagen (ma t/m zo)
- [ ] Gedane workouts hebben `status: "completed"` en bevatten `exercises[]` met set-level data
- [ ] Geplande workouts hebben `status: "planned"` en bevatten `lastPerformance` data
- [ ] Vandaag heeft `status: "today"` (completed als al gedaan, anders planned)
- [ ] Rustdagen hebben `status: "rest"`
**Acceptatiecriteria:**
- [ ] Endpoint authenticated (401 als niet ingelogd)
- [ ] Response bevat per oefening: naam, sets, reps, gewicht, en vorige keer data

---

## Epic R3: Home Redesign

### `R-008` — "Vandaag" workout kaart component
**Omvang:** S
**Beschrijving:** Bouw een prominent component bovenaan de homepage dat toont:
- Workout titel ("UPPER A — Push Focus")
- Geschatte duur (~50 min)
- Lijst van oefeningen met target sets×reps
- "Start in Hevy" deep link (of "Gedaan ✓" als al afgerond)
**Testcases:**
- [ ] Op maandag toont de kaart "Upper A" met oefeningen
- [ ] De kaart toont minimaal 4 oefeningen met sets×reps formaat
- [ ] Als de workout al gedaan is, toont de kaart een "Gedaan" status
- [ ] Op zaterdag/zondag toont de kaart "Rustdag"
**Acceptatiecriteria:**
- [ ] Component gebruikt data van `/api/schema/week`
- [ ] Responsive design (mobile-first)
- [ ] Apple-achtige visuele stijl (geen border-heavy cards)

### `R-009` — Week-at-a-glance component
**Omvang:** S
**Beschrijving:** Bouw een compacte weekweergave die toont:
- 5-7 dag-indicators (ma t/m vr of zo)
- Per dag: workout naam kort + status (done/today/planned/rest)
- Vandaag visueel gemarkeerd
**Testcases:**
- [ ] Component toont minimaal 5 dagen
- [ ] Voltooide dagen hebben een checkmark of vull cirkel
- [ ] Vandaag is visueel anders (bold, accent color)
- [ ] Toekomstige dagen tonen workout naam in muted stijl
**Acceptatiecriteria:**
- [ ] Compact: past in ~60px hoogte
- [ ] Duidelijk visueel verschil tussen done/today/planned/rest

### `R-010` — Compacte weekstatistieken
**Omvang:** XS
**Beschrijving:** Twee of drie compacte stat-blokken: sessies (1/4), trainingstijd (59m), en optioneel tonnage. Vervangt de huidige uitgebreide stats.
**Testcases:**
- [ ] Stats tonen "sessies" label met getal
- [ ] Stats tonen trainingstijd met juiste eenheid (min of uur)
- [ ] Stats zijn zichtbaar op de homepage
**Acceptatiecriteria:**
- [ ] Maximaal 3 stat-blokken
- [ ] Tabular-nums voor getallen

### `R-011` — Nieuwe homepage samenstellen
**Omvang:** S
**Beschrijving:** Vervang de huidige DashboardPage door de nieuwe componenten:
1. Greeting header ("Goedemorgen, Stef")
2. Vandaag workout kaart (R-008)
3. Week-at-a-glance (R-009)
4. Compact stats (R-010)

Verwijder alle oude dashboard cards.
**Testcases:**
- [ ] Homepage toont een greeting met de naam van de gebruiker
- [ ] Homepage toont de vandaag-kaart
- [ ] Homepage toont de week-at-a-glance
- [ ] Homepage bevat NIET: "Spiergroepbelasting", "Sport verdeling", "Workload ratio"
- [ ] Pagina laadt zonder errors, geen empty state als er data is
**Acceptatiecriteria:**
- [ ] Oude DashboardPage componenten vervangen
- [ ] Data komt van `/api/schema/week` en `/api/dashboard`

---

## Epic R4: Schema Pagina

### `R-012` — Schema pagina: week overzicht
**Omvang:** S
**Beschrijving:** Bouw de schema pagina met een weekoverzicht dat toont:
- Weeknummer en schema type ("Week 5 · Upper/Lower Split")
- 4-5 workout kaarten (ma-vr) met status: ✅ gedaan, 🔵 vandaag, ⬚ gepland
- Rustdagen niet prominent tonen
**Testcases:**
- [ ] Schema pagina (`/schema`) toont weeknummer
- [ ] Er zijn minimaal 4 workout kaarten zichtbaar
- [ ] Voltooide workouts tonen een check indicator
- [ ] Toekomstige workouts tonen als "planned" stijl
**Acceptatiecriteria:**
- [ ] Data van `/api/schema/week`
- [ ] Vervangt huidige lege schema placeholder

### `R-013` — Schema pagina: workout detail met oefeningen
**Omvang:** M
**Beschrijving:** Klik op een workout kaart om de oefeningen te zien:
- Oefening naam
- Target: 4×8-10
- Vorige keer: 16kg × 10 reps (uit laatste Hevy workout met die oefening)
- Notities uit het schema (bijv. "Schouderbladen samen")
**Testcases:**
- [ ] Klikken op een workout kaart toont een uitklapbare lijst van oefeningen
- [ ] Elke oefening toont naam, target sets×reps
- [ ] Elke oefening toont "Vorige:" met gewicht en reps (of "—" als eerste keer)
- [ ] Minimaal 4 oefeningen zichtbaar per workout
**Acceptatiecriteria:**
- [ ] Set-level data uit `workout_sets` via API
- [ ] Smooth expand/collapse animatie

### `R-014` — Inline coach knop per oefening
**Omvang:** S
**Beschrijving:** Voeg een klein coach-icoon toe naast elke oefening in het schema. Klikken opent de coach chatpagina met pre-filled context: "Ik heb een vraag over [oefening naam] in mijn [workout] workout."
**Testcases:**
- [ ] Elke oefening in de workout detail heeft een coach-icoon/knop
- [ ] Klikken navigeert naar `/chat` met een query parameter
- [ ] De chat opent met een pre-filled bericht over die specifieke oefening
**Acceptatiecriteria:**
- [ ] Navigatie naar `/chat?context=exercise&name={oefening}`
- [ ] ChatPage leest de query parameter en stuurt initieel bericht

---

## Epic R5: Progressie Redesign

### `R-015` — API endpoint: per-oefening progressie data
**Omvang:** S
**Beschrijving:** Creëer `GET /api/progress/exercise?name=DB+Bench+Press` dat retourneert:
- Per workout datum: max gewicht, max reps bij dat gewicht, totaal volume
- Gesorteerd op datum (oudste eerst)
- Beperkt tot 1 oefening per request
**Testcases:**
- [ ] Response bevat array van `{ date, maxWeight, repsAtMax, totalVolume }` objecten
- [ ] Data is gesorteerd op datum ascending
- [ ] 401 als niet authenticated
- [ ] Lege array als oefening niet bestaat
**Acceptatiecriteria:**
- [ ] Joins workout_sets → workout_exercises → exercise_definitions → workouts
- [ ] Filtert op exercise_definition.name (case-insensitive match)

### `R-016` — Exercise picker en progressie chart
**Omvang:** M
**Beschrijving:** Bouw op de progressie pagina:
1. Zoekbare dropdown met alle oefeningen die de gebruiker heeft gedaan
2. Strakke lijn-chart (gewicht over tijd) — Apple-achtig, niet Recharts Excel-stijl
3. PR badge bij de hoogste waarde
4. Delta label: "+60% sinds start"
**Testcases:**
- [ ] Dropdown toont lijst van oefeningen
- [ ] Selecteren van een oefening toont een chart met datapunten
- [ ] Chart toont gewicht op Y-as en datum op X-as
- [ ] PR punt is visueel gemarkeerd (badge/dot)
- [ ] Delta percentage is zichtbaar
**Acceptatiecriteria:**
- [ ] Minimaal 3 datapunten voor een chart te tonen (anders tekst)
- [ ] Responsive en touch-friendly

### `R-017` — Redesign PR lijst als moderne kaarten
**Omvang:** S
**Beschrijving:** Vervang de huidige PRList door moderne, visueel aantrekkelijke cards:
- Oefening naam prominent
- Huidige PR waarde groot
- Delta badge (+2kg, +60%)
- Datum subtle
**Testcases:**
- [ ] PR lijst toont minimaal 1 PR kaart
- [ ] Elke kaart toont oefening naam, waarde, en delta
- [ ] "NIEUW" badge als PR < 7 dagen oud
**Acceptatiecriteria:**
- [ ] Apple-achtige card design (subtle shadows, geen harde borders)
- [ ] Consistent met het nieuwe design systeem

### `R-018` — Body composition kaart (InBody data)
**Omvang:** S
**Beschrijving:** Toon de meest recente InBody scan data:
- Spiermassa (kg) + delta
- Vetmassa (kg) + delta
- Vetpercentage (%) + delta
- Datum van laatste scan
- "Volgende scan: ~25 apr" reminder
**Testcases:**
- [ ] Body composition kaart is zichtbaar op progressie pagina
- [ ] Toont spiermassa, vetmassa, en vetpercentage
- [ ] Toont delta's ten opzichte van vorige scan
- [ ] Als er geen InBody data is: toont empty state
**Acceptatiecriteria:**
- [ ] Data uit `personal_records` tabel (record_type: muscle_mass, fat_mass, body_fat_percentage)
- [ ] Vergelijkt laatste 2 scans voor delta

### `R-019` — Verwijder oude charts van progressie pagina
**Omvang:** XS
**Beschrijving:** Verwijder VolumeChart, StrengthChart, en RunningChart. Deze worden vervangen door de per-oefening progressie (R-016).
**Testcases:**
- [ ] Progressie pagina bevat geen gestapelde bar charts
- [ ] Progressie pagina bevat geen "Kracht per bewegingspatroon" tekst
- [ ] Progressie pagina bevat geen "Hardlopen" chart
- [ ] Pagina laadt zonder errors
**Acceptatiecriteria:**
- [ ] Componenten niet meer geïmporteerd in ProgressPage.tsx

---

## Epic R6: Google Calendar Integratie

### `R-020` — Google OAuth koppeling in Settings
**Omvang:** M
**Beschrijving:** Voeg Google Calendar koppeling toe aan de settings pagina:
- "Koppel Google Calendar" knop
- OAuth 2.0 flow (consent screen → callback → token opslag)
- Status indicator (verbonden/niet verbonden) net als Hevy
- "Ontkoppel" optie
**Testcases:**
- [ ] Settings pagina toont een "Google Calendar" sectie
- [ ] Knop "Koppel Google Calendar" is klikbaar
- [ ] Na koppeling: status dot wordt groen
- [ ] "Ontkoppel" knop is zichtbaar wanneer gekoppeld
**Acceptatiecriteria:**
- [ ] OAuth tokens veilig opgeslagen (encrypted in user_settings of aparte tabel)
- [ ] Refresh token flow voor verlopen access tokens
- [ ] Google Cloud project met Calendar API enabled

### `R-021` — API endpoint: Google Calendar events aanmaken
**Omvang:** M
**Beschrijving:** Creëer `POST /api/calendar/events` dat workout events aanmaakt:
- Input: array van `{ title, date, startTime, endTime, description }`
- Gebruikt Google Calendar API met opgeslagen OAuth token
- Event beschrijving bevat oefeningen lijst
**Testcases:**
- [ ] POST met geldige data retourneert 201 met event IDs
- [ ] 401 als niet authenticated
- [ ] 400 als Google niet gekoppeld
- [ ] Event verschijnt in Google Calendar (handmatig te verifiëren)
**Acceptatiecriteria:**
- [ ] Gebruikt googleapis npm package
- [ ] Handles token refresh automatisch

### `R-022` — "Plan je week" UI op schema pagina
**Omvang:** M
**Beschrijving:** Voeg een "Plan in agenda" knop toe aan de schema pagina:
1. Klik opent een planning modal
2. Per workout: datum staat vast (ma-do), tijd instelbaar (default 06:30-07:30)
3. Hardlopen (vr): optioneel, met tijd
4. "Toevoegen aan agenda" knop → maakt events aan via R-021
5. Bevestiging: "4 workouts ingepland ✓"
**Testcases:**
- [ ] "Plan in agenda" knop zichtbaar op schema pagina (alleen als Google gekoppeld)
- [ ] Modal toont 4-5 workouts met tijdpickers
- [ ] Na bevestiging toont success melding met aantal events
- [ ] Knop is hidden/disabled als Google niet gekoppeld (met hint naar settings)
**Acceptatiecriteria:**
- [ ] Tijd defaults naar 06:30-07:30 (Stefs patroon)
- [ ] Beschrijving van event bevat oefeningenlijst

---

## Epic R7: Coach Integratie

### `R-023` — Contextuele coach vanuit schema
**Omvang:** S
**Beschrijving:** Wanneer de coach geopend wordt vanuit een oefening in het schema:
- Pre-fill het chatbericht met context ("Ik heb een vraag over [oefening] in mijn [workout]")
- Stuur de oefening naam + laatste prestatie data mee als extra context voor Claude
- Coach geeft een antwoord dat specifiek is voor die oefening
**Testcases:**
- [ ] Navigatie vanuit schema oefening naar `/chat?context=exercise&name=DB+Bench+Press` werkt
- [ ] Chat toont een pre-filled bericht
- [ ] Coach response refereert aan de specifieke oefening
**Acceptatiecriteria:**
- [ ] Query params worden gelezen in ChatPage
- [ ] Extra context wordt meegestuurd naar chat API

---

## Volgorde & Dependencies

```
R-001 (Playwright setup)
  │
  ├── R-002, R-003, R-004, R-005 (Cleanup — parallel, geen deps)
  │
  ├── R-006, R-007 (Schema API — nodig voor Home + Schema pagina)
  │     │
  │     ├── R-008, R-009, R-010 → R-011 (Home redesign)
  │     │
  │     └── R-012 → R-013 → R-014 (Schema pagina)
  │
  ├── R-015 → R-016, R-017, R-018 → R-019 (Progressie)
  │
  ├── R-020 → R-021 → R-022 (Google Calendar)
  │
  └── R-023 (Coach integratie — na R-014)
```

**Fase 1 (week 1):** R-001 t/m R-011 (infrastructure + cleanup + home)
**Fase 2 (week 1-2):** R-012 t/m R-014 (schema pagina)
**Fase 3 (week 2):** R-015 t/m R-019 (progressie redesign)
**Fase 4 (week 2-3):** R-020 t/m R-023 (Google Calendar + coach)
