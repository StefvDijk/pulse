> **Visual references in this plan resolve to the v2 design system.**
> Source of truth: `pulse/design/design_handoff_pulse_v2/` (tokens: `tokens.js`,
> screens: `screens/*.jsx`, spec: `README.md`).
>
> Any reference to "Mineral", "light theme", "Inter", or `PULSE-DESIGN-SYSTEM.md`
> in this document is **stale** — substitute the v2 dark tokens. Story intent
> and structure below remain valid; class-name color references resolve to
> the v2 dark palette in `tokens.js`.

---

# Plan: Homescreen Redesign — Van Data Page naar Digital Sport Twin

**Datum:** 3 april 2026
**Status:** Compleet (afgerond 2026-05-15). Stap 4 (TodayWorkoutCard upgrade) is bewust achterhaald: `TodayHero` is vervangen door `CoachCard` (signal-driven, inklapbaar, tap → chat met seed).
**Afhankelijkheden:** Geen — kan direct

---

## Samenvatting

Het huidige homescreen is een data-aggregatiepagina: begroeting, vandaag's workout, weekstrip, ruwe stats, health metrics, en een feed van 29+ activiteiten. Het doel is om het te transformeren naar een **"digital sport twin"** — een pagina die één vraag beantwoordt: *"Wat moet ik vandaag doen?"*

Geïnspireerd door: Whoop (Recovery score), Oura (One Big Thing), Fitbod (muscle freshness), MacroFactor (adaptive intelligence), Apple Fitness (completion rings).

---

## Huidige structuur (wat er nu is)

| # | Component | Bestand | Probleem |
|---|-----------|---------|----------|
| 1 | Begroeting | `DashboardPage.tsx` | Prima, behouden |
| 2 | TodayWorkoutCard | `src/components/home/TodayWorkoutCard.tsx` | Goed, maar mist achievement-signalen |
| 3 | WeekAtAGlance | `src/components/home/WeekAtAGlance.tsx` | Goed, mist sessie-teller en sport-iconen |
| 4 | CompactStats | `src/components/home/CompactStats.tsx` | kg volume niet relevant, data dump |
| 5 | DailyHealthBar | `src/components/home/DailyHealthBar.tsx` | Goed als context, maar begraven onder stats |
| 6 | ActivityFeed | `src/components/home/ActivityFeed.tsx` | 29 items, niet relevant op homescreen |
| 7 | ACWR/Belasting | Onderdeel van CompactStats | Goed signaal, verkeerde plek (onderaan) |

---

## Nieuwe structuur (van boven naar beneden)

### 1. Begroeting + Readiness Signal (NIEUW)

**Wat:** Eén kleur-gecodeerd signaal (groen/geel/rood) + één zin coaching.

**Inputs voor berekening:**
- ACWR (hebben we, uit `weekly_aggregations`)
- Slaapkwaliteit/duur (uit `sleep_logs` als beschikbaar)
- Resting HR (uit `daily_activity` als beschikbaar)
- HRV (uit `daily_activity` als beschikbaar)
- Recente trainingsfrequentie (aantal sessies afgelopen 3 dagen)

**Readiness levels:**
| Level | Kleur | Wanneer | Voorbeeld coaching |
|-------|-------|---------|-------------------|
| Goed hersteld | Groen (`sport-gym`) | ACWR 0.8-1.3, slaap ≥7u, HRV normaal | "Goed hersteld. Upper A staat op schema — ga ervoor." |
| Normaal | Geel/Amber | ACWR 0.5-0.8 of 1.3-1.5, of slaap 6-7u | "Prima om te trainen. Luister naar je lichaam." |
| Vermoeid | Rood (`status-red`) | ACWR >1.5 of <0.5, slaap <6u, HRV laag | "3 zware dagen achter de rug. Neem het rustig aan." |
| Rustdag | Neutraal | Geen workout gepland | "Rustdag. Morgen: Lower B. Geniet van je herstel." |

**Coaching tekst logica:** Geen AI-call nodig. Template-based op basis van:
- Readiness level
- Vandaag's geplande workout (uit schema)
- Morgen's workout (context voor rustdagen)
- Opvallende data (PR gisteren, streak, etc.)

**Component:** `ReadinessSignal.tsx` (nieuw)

**Datasource:** Combinatie van bestaande hooks (`useSchemaWeek`, `useTodayHealth`, `useDashboardData`). Mogelijk een nieuw endpoint `/api/readiness` dat alles combineert.

---

### 2. Vandaag's Workout (BEHOUDEN, verbeterd)

**Wat verandert:**
- **Achievement highlight**: Als de workout al gedaan is, toon het belangrijkste resultaat:
  - PR behaald → "🏆 PR: Lat Pulldown 42.5kg"
  - Gewicht omhoog → "+2kg op Bench Press vs vorige sessie"
  - Alle sets gedaan → "Alle sets afgerond"
- **Rustdag context**: Toon morgen's workout ("Morgen: Lower A om 06:30")
- **Hardlopen/Padel**: Relevante metrics (afstand, locatie)

**Bestand:** `src/components/home/TodayWorkoutCard.tsx` (aanpassen)

**Data nodig:** PR-detectie kan uit `personal_records` tabel of vergelijking met vorige sessie.

---

### 3. Week Strip (BEHOUDEN, verbeterd)

**Wat verandert:**
- **Sessie-teller** eronder: "3/4 gym · 1 run · 1 padel"
- **Sport-iconen** per dag: dumbbell (gym), running shoe (run), padel racket (padel), zon (rust)
- Stats grid (CompactStats) verdwijnt — de relevante info zit nu in de week strip

**Bestand:** `src/components/home/WeekAtAGlance.tsx` (aanpassen)

---

### 4. Health Vitals (BEHOUDEN, omhoog)

**Wat verandert:**
- Schuift omhoog (zat onder CompactStats, nu direct na week strip)
- Eventueel: gewichtstrend als sparkline ipv alleen vandaag's getal
- Verder ongewijzigd — het is al compact en goed

**Bestand:** `src/components/home/DailyHealthBar.tsx` (geen wijzigingen of minimaal)

---

### 5. Coach Nudge (NIEUW, optioneel)

**Wat:** Een klein kaartje met een proactief AI-inzicht of actie-item.

**Voorbeelden:**
- "Week 3 nog niet afgesloten — check in!" (→ link naar `/check-in`)
- "Je eiwitinname was 3 van de 5 dagen onder target."
- "Je bent deze week nog niet hardgelopen."
- "InBody scan 3 staat gepland volgende week."

**Logica:** Template-based triggers op basis van data. Geen real-time AI-call.

**Prioriteit:** Laag — kan later. Focus eerst op de opruiming en readiness signal.

**Component:** `CoachNudge.tsx` (nieuw, later)

---

## Wat WEG gaat

| Component | Actie | Waarom |
|-----------|-------|--------|
| `CompactStats.tsx` | Verwijderen van homescreen | kg volume niet relevant, sessie-info naar week strip, ACWR naar readiness signal |
| `ActivityFeed.tsx` | Verwijderen van homescreen | 29 items is data dump. Later: verplaats naar apart tabblad of `/activiteiten` |
| `ActivityCard.tsx` | Blijft bestaan | Wordt niet verwijderd, alleen niet meer op home getoond |
| ACWR blokje | Verplaatsen | Wordt onderdeel van ReadinessSignal |
| Hevy Sync knop | Verplaatsen | Naar Instellingen of een apart tabblad |

---

## Implementatiestappen

### Stap 1: Opruimen (klein)
- [x] `CompactStats` verwijderen uit `DashboardPage.tsx`
- [x] `ActivityFeed` verwijderen uit `DashboardPage.tsx`
- [x] Hevy Sync knop verplaatsen naar instellingen — nu onder sectie "Synchronisatie" in `SettingsPage.tsx`
- [x] Testen: homescreen toont nu alleen greeting + workout + weekstrip + health

### Stap 2: Week Strip verbeteren (klein)
- [x] Sessie-teller toevoegen ("3/4 gym · 1 run") — zie `WeekGlance.tsx` regel 64
- [x] Sport-type iconen per dag (dumbbell/runner/racket) — via lucide-icons in `WeekGlance.tsx`
- [x] Data: sport type afleiden uit workout title of aparte property — via `ActivityToken.type`

### Stap 3: Readiness Signal bouwen (medium)
- [x] Readiness berekening: combineer ACWR + slaap + HR data — `/api/readiness`
- [x] `ReadinessCard.tsx` component met kleur-codering (v2 dark)
- [x] Coaching tekst (NL) — AI-gegenereerd via `/api/readiness/summary` met fallback-template
- [x] Geïntegreerd bovenaan `DashboardPage.tsx` (onder begroeting)

### ~~Stap 4: TodayWorkoutCard verbeteren~~ → ACHTERHAALD (2026-05-15)
~~Originele scope (PR-detectie, rustdag-context, multi-sport).~~ `TodayHero` is verwijderd uit de homescreen en vervangen door `CoachCard` — een signal-driven kaart die alleen verschijnt bij anomaly (slaap <6u, ACWR buiten 0.5–1.5) of readiness fatigued/rest_day. Reden: een statisch "vandaag = gym" blok herhaalt info die je al weet. Zie sectie "Coach card (vervangt TodayHero)" hieronder.

### Stap 5: Coach Card (DONE 2026-05-15)
- [x] Signal-bron `useCoachSignal` — `summary.sentence` + anomaly-triggers (slaap, ACWR, fatigued, rest_day)
- [x] `CoachCard.tsx` component met collapse-state per signal-id in localStorage
- [x] Tap-to-chat: `/chat?seed=<text>` opent thread met de melding als eerste AI-bericht
- [x] Server-side persistence: seed-bericht wordt opgeslagen in `chat_messages` met `message_type: 'coach_nudge'`
- [x] Check-in badge integratie — `CheckInBadge` blijft separaat slot (weekend/maandag trigger)

---

## Coach card (vervangt TodayHero)

**Doel:** één signal-driven kaart die alleen verschijnt als er iets te zeggen valt, niet 24/7. Tap opent een chat-thread waar de melding de eerste AI-zin is, zodat je direct kan doorvragen.

**Toon-regels (`useCoachSignal`):**
| Trigger | Wanneer | Signal-ID | Bron tekst |
|---|---|---|---|
| Slaap <6u | dagelijks | `<date>:sleep-short` | `summary.sentence` |
| ACWR <0.5 of >1.5 | dagelijks | `<date>:acwr-low` / `acwr-high` | `summary.sentence` |
| Readiness = fatigued | dagelijks | `<date>:level-fatigued` | `summary.sentence` |
| Readiness = rest_day | dagelijks | `<date>:level-rest_day` | `summary.sentence` |
| Goal achter target | maandag (gap >5%) | `<monday>:goal-progress:<goalId>` | "Je zit nog Xkg af van je doel: <titel>" |
| Anders | — | (geen signaal) | kaart verborgen |

**Inklap-gedrag:** localStorage key `pulse:coachCard:collapsed:<signalId>`. Nieuw signaal = nieuwe key = vanzelf weer uitgeklapt.

**Latere uitbreidingen:** extra trigger-bronnen (eiwit-target gemist 3+ dagen, geplande sessie 24u gemist, gewicht-trend afwijking, week-doel achterstand, weekly check-in badge fusie).

---

## Niet in scope

- Light/dark mode toggle (dark mode uitgesloten per design system)
- Customizable dashboard tiles (MacroFactor-stijl) — overkill voor single-user
- Social features (Strava-stijl) — single-user app
- Push notifications — later, vereist PWA/service worker
- ActivityFeed verplaatsen naar apart tabblad — aparte taak
