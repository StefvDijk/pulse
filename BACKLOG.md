# BACKLOG.md — UX Redesign

Alle stories die voortvloeien uit `PLAN-UX-REDESIGN.md`. Volgorde = sprint-volgorde uit dat plan. Story-IDs zijn `UXR-xxx` (UX Redesign) zodat ze niet conflicteren met bestaande `PULSE-xxx` of `WC-xxx`-tickets.

**Conventies:**
- Size: XS (<1u) / S (1–4u) / M (4u–1d) / L (1–3d) / XL (>3d → splitsen)
- Sprint-numbering volgt `PLAN-UX-REDESIGN.md` § *Aanbevolen volgorde*
- Acceptatiecriteria zijn observable: getest in browser, of via een test-script. Geen "code is geschreven" criteria.
- Status: ⬜ open · 🟡 in progress · ✅ done (gemerged + getest)

## Status overview

| Sprint | Stories | Status |
|---|---|---|
| Sprint 0 — Bugfixes | UXR-001, UXR-002 | ✅ done (commit 6982f69) |
| Sprint 1 — Coaching tone & corridor | UXR-010, UXR-011, UXR-020, UXR-030 | ✅ done (commit 661d149) |
| Sprint 2 — Homescreen identity | UXR-040, UXR-050, UXR-060 | ✅ done (commit 5b7297c) |
| Sprint 3 — Foundation: baseline-engine | UXR-100, UXR-101, UXR-102 | ✅ done (commit a3cc046) — **vereist migration + types regen** |
| Sprint 4 — Visuele rijkheid | UXR-070, UXR-080, UXR-090 | ✅ done — pending preview test |
| Sprint 5 — Differentiator features | UXR-110, UXR-120, UXR-121, UXR-122 | UXR-120 ✅ done · rest ⬜ open |
| Sprint 6 — Polishing | UXR-130, UXR-140, UXR-150, UXR-160 | ⬜ open |
| Later | UXR-200, UXR-210, UXR-220 | ⬜ open |

---

# Sprint 0 — Bugfixes (vandaag)

## UXR-001 — Login redirect met full page reload  ✅

**Tier:** 0.1 · **Size:** XS · **Depends on:** —

**Files:** `src/app/auth/login/page.tsx`, `src/app/auth/signup/page.tsx`

**Acceptatiecriteria:**
- [ ] Na succesvolle login leidt de app eerste keer raak door naar `/`
- [ ] Geen redirect-terug-naar-login (bevestigd door 5x inloggen na uitloggen)
- [ ] Idem voor `/auth/signup` na registratie
- [ ] Geen flash van een lege/loading state >500ms

**Notes:** `router.push('/'); router.refresh()` → `window.location.assign('/')`. Geen functionele veranderingen elders.

---

## UXR-002 — Chat scroll niet meer schokkerig  ✅

**Tier:** 0.2 · **Size:** S · **Depends on:** —

**Files:** `src/components/chat/ChatInterface.tsx`, `src/components/chat/ChatMessage.tsx`

**Acceptatiecriteria:**
- [ ] Tijdens streaming: geen smooth-scroll-animaties die elkaar opheffen
- [ ] Wanneer gebruiker handmatig naar boven scrollt tijdens streaming, blijft de view daar staan (geen auto-snap-back)
- [ ] Wanneer gebruiker binnen 120px van de bodem zit, volgt de view automatisch (instant scroll)
- [ ] Bij nieuwe user-message: smooth scroll naar bodem
- [ ] React-markdown re-rendert niet onnodig (verifieerbaar via React DevTools profiler — render-tijd voor incoming chunks <5ms)

**Notes:**
- Splits scroll-effect in twee `useEffect`s: één voor `messages`, één voor `streamingContent`
- Module-level constante voor `components` prop in `ChatMessage`
- rAF-throttle voor streaming scroll
- Helper `isNearBottom(el, threshold)` om de auto-scroll-conditie te checken

---

# Sprint 1 — Coaching tone & corridor (deze week)

## UXR-010 — One-sentence readiness summary endpoint  ✅

**Tier:** 1.1 (deel 1) · **Size:** S · **Depends on:** —

**Files:** nieuwe `src/app/api/readiness/summary/route.ts`, `src/lib/ai/prompts/readiness-summary.ts`

**Acceptatiecriteria:**
- [ ] GET endpoint retourneert `{ sentence: string, score: number, breakdown: { sleep, hrv, rhr } }`
- [ ] Sentence is in het Nederlands, max 25 woorden, scenario-aware
- [ ] Gebruikt `claude-haiku-4-5` (kosten-bewust)
- [ ] Resultaat wordt 4 uur gecached per gebruiker (in-memory of DB)
- [ ] Faalt graceful — bij Claude error returnt fallback sentence ("Geen recente data — train op gevoel")

**Notes:** prompt geeft alleen de meest recente slaap/HRV/RHR + baseline (kan per nu hardcoded zijn — definitieve baseline komt in UXR-100)

---

## UXR-011 — ReadinessSignal redesign  ✅

**Tier:** 1.1 (deel 2) · **Size:** S · **Depends on:** UXR-010

**Files:** `src/components/home/ReadinessSignal.tsx`

**Acceptatiecriteria:**
- [ ] Card toont, in deze volgorde: 1 zin → groot getal met ring → 3 micro-bars (slaap/HRV/RHR)
- [ ] Hero-getal is ≥56pt op mobiel
- [ ] Ring kleurt mee met score-bucket (groen/amber/rood)
- [ ] Mobiel + desktop gevalideerd (geen overflow op 360px breedte)
- [ ] Bij missing data: skeleton loading, geen errors zichtbaar

---

## UXR-020 — ACWR corridor chart op /belasting  ✅

**Tier:** 1.2 · **Size:** S · **Depends on:** —

**Files:** `src/app/belasting/page.tsx`, mogelijk nieuwe `src/components/belasting/AcwrCorridor.tsx`

**Acceptatiecriteria:**
- [ ] Recharts line chart toont 8 weken ACWR
- [ ] Lichtgroene `ReferenceArea` bandgebied 0.8–1.3
- [ ] Punten buiten band krijgen rode/oranje tint
- [ ] Tap op punt = tooltip met week-detail (sessies, tonnage, ratio)
- [ ] Vervangt of complementeert de huidige `zone bar` (te kiezen na review)

**Notes:** behoud bestaande sparkline + cards voor nu. Corridor is de nieuwe hero.

---

## UXR-030 — CoachOrb component  ✅

**Tier:** 1.3 · **Size:** S · **Depends on:** —

**Files:** nieuwe `src/components/shared/CoachOrb.tsx`, integraties in `ChatInterface.tsx`, `ChatMessage.tsx`, `CoachAnalysisCard.tsx`, `home/ReadinessSignal.tsx`

**Acceptatiecriteria:**
- [ ] Component accepteert props: `size`, `state` (`idle | streaming | ready | warning | alert`), `pulsing` (bool)
- [ ] SVG-based, geen extra dependencies
- [ ] Pulserende animatie bij `streaming=true`, gerespecteert `prefers-reduced-motion`
- [ ] Vier kleur-tints (blauw/groen/amber/rood) komen overeen met readiness-buckets
- [ ] Vervangt de huidige `animate-pulse` cursor in `ChatMessage`
- [ ] Verschijnt in chat-header (next to "AI Coach"), readiness card, en check-in coach card

**Notes:** Final visuele keuze (B in plan): **Functional** tinting bevestigd.

---

# Sprint 2 — Homescreen identiteit

## UXR-040 — Home hero metric  ✅

**Tier:** 1.4 · **Size:** S · **Depends on:** UXR-030

**Files:** nieuwe `src/components/home/HomeHero.tsx`, `src/components/dashboard/DashboardPage.tsx`

**Acceptatiecriteria:**
- [ ] Eén grote metric bovenaan home, contextueel afhankelijk van dag-type:
  - Trainingsdag → vandaag's hoofd-set ("4×8 @60kg DB Bench")
  - Rustdag → slaap-uren of stappen
  - Check-in dag → sessies deze week
- [ ] Editorial typography: ≥80pt op mobiel, gegenereerd-via SF Pro of Tailwind `text-display-1`
- [ ] Coach Orb subtiel rechtsboven
- [ ] Klik = navigatie naar relevante detail-pagina (`/schema`, `/`, `/check-in`)

---

## UXR-050 — Time-of-day theming  ✅

**Tier:** 1.5 · **Size:** S · **Depends on:** —

**Files:** `tailwind.config.ts`, `src/app/layout.tsx`, nieuwe `src/hooks/useTimeOfDay.ts`

**Acceptatiecriteria:**
- [ ] Vier gradient-tokens (`time-dawn`, `time-day`, `time-dusk`, `time-night`)
- [ ] CSS variable wisselt elke 15 min (op de minuut), of bij visibility change
- [ ] Effect zichtbaar maar subtiel (≤10% saturation)
- [ ] Geen flash van wrong gradient bij SSR (server-side default = `time-day`, hydrate-after = correcte waarde)
- [ ] Lighthouse-score voor home blijft groen (geen reflows)

---

## UXR-060 — Pulse Triad (Train · Recover · Fuel)  ✅

**Tier:** 2.1 · **Size:** M · **Depends on:** UXR-040 (om dezelfde plek te delen)

**Files:** nieuwe `src/components/home/PulseTriad.tsx`, nieuwe hook `src/hooks/useTriadData.ts`

**Acceptatiecriteria:**
- [ ] Drie ringen renderen op home, direct onder of als deel van HomeHero
- [ ] **Train ring**: vol bij wekelijks sessie-doel (bron: `user_settings.gym/run/padel_target`)
- [ ] **Recover ring**: vol bij ACWR in band + slaap ≥7u baseline
- [ ] **Fuel ring**: vol bij dagelijks eiwit + calorie target gehaald
- [ ] Tap op ring = navigatie naar `/schema`, `/belasting`, `/nutrition` respectievelijk
- [ ] Animatie via `motion` (al in deps), 60fps
- [ ] Werkt bij missing data (lege ring, geen crash)
- [ ] Vervangt of degradeert `WeekAtAGlance` (besluit na review)

**Notes:** custom SVG. Geen Recharts (te zwaar voor 3 ringen). Voorbeeld voor implementatie: Apple Activity Rings layout.

---

# Sprint 3 — Foundation: baseline-engine

## UXR-100 — Schema voor `metric_baselines`  ✅

**Tier:** 3.1 (deel 1) · **Size:** S · **Depends on:** —

**Files:** nieuwe migration `supabase/migrations/2026XXXX_metric_baselines.sql`, `src/types/database.ts` (regenerate)

**Acceptatiecriteria:**
- [ ] Tabel `metric_baselines` met kolommen: `user_id`, `metric`, `date`, `value_30d_avg`, `value_60d_avg`, `value_365d_avg`, `created_at`
- [ ] Composite primary key `(user_id, metric, date)`
- [ ] RLS policy: alleen `user_id = auth.uid()`
- [ ] Index op `(user_id, metric, date DESC)` voor snelste lookup van laatste waarde
- [ ] Migration draait schoon op een lege DB en op een DB met bestaande data
- [ ] Types geregenereerd via `supabase gen types typescript --local`

---

## UXR-101 — Baseline-aggregator service  ✅

**Tier:** 3.1 (deel 2) · **Size:** M · **Depends on:** UXR-100

**Files:** nieuwe `src/lib/baselines/aggregate.ts`, `src/lib/baselines/lookup.ts`, uitbreiding `src/app/api/cron/daily-aggregate/route.ts`

**Acceptatiecriteria:**
- [ ] `aggregate.ts` berekent per metric (sleep, hrv, rhr, weight, acwr, protein, tonnage) de 30/60/365-dag rolling averages voor *vandaag*
- [ ] Idempotent: tweede run op dezelfde dag overschrijft/upsert correct
- [ ] Cron-job runs in de bestaande daily-aggregate flow
- [ ] `lookup.ts` exporteert `getBaseline(userId, metric, window)` met sub-50ms lookup time
- [ ] Eenheidstest dekt: empty data, 1-dag-data, edge case rond 30/60/365 boundaries
- [ ] Backfill-script `scripts/backfill-baselines.ts` voor historische data

---

## UXR-102 — Baseline-tag UI helper  ✅

**Tier:** 3.1 (deel 3) · **Size:** S · **Depends on:** UXR-101

**Files:** nieuwe `src/components/shared/BaselineTag.tsx`, `src/lib/baselines/format.ts`

**Acceptatiecriteria:**
- [ ] Component renders `↑12% vs 30d` (of pijlen ↗︎/↘︎ + percentage)
- [ ] Kleur: groen (positieve trend voor metric type), rood (negatieve), grijs (binnen ±2% ruis)
- [ ] Helper `formatBaseline(currentValue, baseline, options)` retourneert object voor consistente render
- [ ] Helper kent metric-richtingen (slaap+ = goed, RHR+ = slecht)
- [ ] Inzetbaar in alle bestaande cards: ReadinessSignal, DailyHealthBar, BodyComposition, etc.

---

# Sprint 4 — Visuele rijkheid

## UXR-070 — Workout heatmap-card hero  ✅

**Tier:** 2.2 · **Size:** M · **Depends on:** —

**Files:** `src/components/home/WorkoutFeedCard.tsx`, `src/components/dashboard/MuscleHeatmap.tsx` (variant prop)

**Acceptatiecriteria:**
- [ ] Elke workout-feed-card toont een mini muscle heatmap (~120px hoog) als hero
- [ ] Heatmap gebruikt alleen die ene sessie's spier-activatie (niet wekelijks aggregaat)
- [ ] Onder heatmap: titel, tijdstempel, duur, tonnage, optionele PR-badge
- [ ] Heatmap variant `mode="single-session"` toegevoegd aan bestaande component
- [ ] Bij workouts zonder muscle data (oude entries): valt terug op huidige tekst-card

---

## UXR-080 — Today's Move card  ✅

**Tier:** 2.4 · **Size:** M · **Depends on:** UXR-040

**Files:** nieuwe `src/components/home/TodaysMove.tsx`, nieuwe `src/app/api/today/route.ts`

**Acceptatiecriteria:**
- [ ] Hero card bovenaan home (~50% schermhoogte mobiel)
- [ ] Toont één dagelijkse handeling met titel + sub-tekst + 1 actie-knop
- [ ] Determination logic: trainingsdag (uit schema), rustdag, kantoordag, check-in zondag
- [ ] AI-gegenereerde sub-tekst (1 keer per dag gecached, fallback bij Claude error)
- [ ] Actie-knop linkt context-specifiek (`/schema`, `/check-in`, `/`)
- [ ] Werkt zonder actief schema (fallback "Train op gevoel vandaag")

---

## UXR-090 — Tonnage trend + body comp sparkline  ✅

**Tier:** 2.5 · **Size:** M · **Depends on:** UXR-100, UXR-101 (voor de "vs baseline" tags)

**Files:** uitbreiding `src/app/progress/page.tsx`, nieuwe of uitgebreide `src/components/home/BodyCompositionCard.tsx`

**Acceptatiecriteria:**
- [ ] /progress: tonnage line chart per week, 8 weken default
- [ ] Markers waar trainingsblokken begonnen/eindigden (uit `training_schemas` history)
- [ ] Body comp card op home: 4-week sparkline per metric (gewicht, vetmassa, spiermassa)
- [ ] Composition bar (%vet/%spier) onderaan
- [ ] Baseline-tag op elk hoofdgetal (zie UXR-102)

---

# Sprint 5 — Differentiator features

## UXR-110 — Sport-correlation panel

**Tier:** 3.2 · **Size:** L · **Depends on:** UXR-100, UXR-101

**Files:** nieuwe `src/lib/load/sport-correlations.ts`, uitbreiding `src/app/belasting/page.tsx`, nieuwe `src/components/belasting/SportCorrelations.tsx`

**Acceptatiecriteria:**
- [ ] Per sport (gym/run/padel) een fatigue-score 0–100 op basis van laatste 72u
- [ ] Gestapelde bar toont relatieve bijdrage aan totale belasting
- [ ] Wekelijks AI-gegenereerd insight in coaching_memory: "X dagcombinatie is jouw zwaarste"
- [ ] Cron-job extends `weekly-aggregate` om insights te schrijven
- [ ] Insight verschijnt op `/belasting` als card onder de correlation-panel
- [ ] Test scenario: 4 weken gemixte data → zinnige insight, niet generiek

**Notes:** dit is *de* differentiator volgens het plan. Verdient extra zorg in copy en visualisatie.

---

## UXR-120 — Schema voor coaching memory feed  ✅

**Tier:** 3.3 (deel 1) · **Size:** S · **Depends on:** —

**Files:** nieuwe migration `supabase/migrations/2026XXXX_weekly_lessons.sql`

**Acceptatiecriteria:**
- [ ] Tabel `weekly_lessons` met `user_id`, `week_start`, `lesson_text`, `category`, `created_at`
- [ ] Index op `(user_id, week_start DESC)`
- [ ] RLS policy
- [ ] Migration draait schoon

---

## UXR-121 — Journal pagina

**Tier:** 3.3 (deel 2) · **Size:** M · **Depends on:** UXR-120

**Files:** nieuwe `src/app/journal/page.tsx`, eventueel uitbreiding bottom nav

**Acceptatiecriteria:**
- [ ] Toont coaching_memory gegroepeerd per categorie (program, lifestyle, injury, preference, pattern, goal)
- [ ] Per item: tekst, datum, edit/verwijder knop
- [ ] "Lessons learned" tijdlijn-sectie (uit `weekly_lessons`)
- [ ] Zoekbalk filtert op tekst (client-side, niet kritiek voor v1)
- [ ] Wordt opgenomen in bottom nav of als settings-tab (review-besluit)

---

## UXR-122 — Wekelijkse lessons-extractor

**Tier:** 3.3 (deel 3) · **Size:** S · **Depends on:** UXR-120, bestaande memory-extractor

**Files:** uitbreiding `src/lib/ai/memory-extractor.ts` of nieuwe `src/lib/ai/lessons-extractor.ts`, cron in `weekly-aggregate`

**Acceptatiecriteria:**
- [ ] Cron job runs op zondag, leest week-data (workouts, runs, nutrition, check-in resultaat)
- [ ] Genereert 1–2 lessen via `claude-haiku-4-5`
- [ ] Schrijft naar `weekly_lessons`
- [ ] Bij Claude error: faalt stil (logged), geen broken cron
- [ ] Test: vraag de extractor naar een afgelopen week, verifieer redelijke output

---

# Sprint 6 — Polishing

## UXR-140 — Goal-driven chat suggestions

**Tier:** 1.6 · **Size:** M · **Depends on:** —

**Files:** `src/components/chat/ChatSuggestions.tsx`, nieuwe `src/app/api/chat/suggestions/route.ts`

**Acceptatiecriteria:**
- [ ] Endpoint retourneert ≤3 dynamische suggesties + 1 vaste
- [ ] Suggesties baseren op: actieve goals, blessures, dagen sinds laatste sessie, coaching memory
- [ ] Suggesties Nederlands, max 8 woorden
- [ ] Component gebruikt SWR met 5min cache
- [ ] Bij geen goals/blessures: fallback naar 3 generieke (huidige content)

---

## UXR-160 — Burn Bar in weekly check-in

**Tier:** 2.3 · **Size:** S · **Depends on:** UXR-101 (voor de baselines)

**Files:** nieuwe `src/components/check-in/WeekTier.tsx`, integratie in `src/components/check-in/WeekReviewCard.tsx`

**Acceptatiecriteria:**
- [ ] Toont 5-tier visueel (Achterstand / Op stoom / In ritme / Voor de troepen uit / Topweek)
- [ ] Genormaliseerd t.o.v. *jouw* laatste 4-8 weken (input van baseline-engine)
- [ ] Ronde marker positionering op horizontale bar
- [ ] Klein label "vs jouw 4-weken gemiddelde"
- [ ] Tap = expand met breakdown welke metrics dit veroorzaakten

---

## UXR-150 — Compacte baseline-tags overal

**Tier:** 1.7 · **Size:** S · **Depends on:** UXR-102

**Files:** alle home-cards die getallen tonen — verwacht 5-8 bestanden

**Acceptatiecriteria:**
- [ ] Elke card met enkel hero-getal heeft een `<BaselineTag>` ernaast
- [ ] Achtervoegsel altijd `text-label-tertiary` + `text-caption2`
- [ ] Geen tag tonen als baseline-data ontbreekt (geen "↑0%" of "—")
- [ ] Test: bekijk home en /progress — ervaar de samenhang

---

## UXR-130 — Goals praten met PR's

**Tier:** 3.4 · **Size:** M · **Depends on:** UXR-101

**Files:** uitbreiding `src/components/goals/GoalCard.tsx`, nieuwe `src/lib/goals/auto-link.ts`

**Acceptatiecriteria:**
- [ ] Service detecteert in goal-titel een exercise-naam (fuzzy match tegen `exercise_definitions`)
- [ ] Goal card toont: laatste 6 sessies' best-set sparkline (als gekoppeld)
- [ ] Bij goal-completion: confetti-animatie (lightweight, niet `react-confetti` als het kan zonder)
- [ ] Auto-archiveer goal bij completion via DB trigger of cron
- [ ] Wekelijks coach-bericht in chat: "Je zit nog Xkg af van doel Y"

---

# Later (niet nu prioriteit)

## UXR-200 — Schema-overview met inline peek

**Tier:** 2.6 · **Size:** S

## UXR-210 — Quick check-in bottom-sheet

**Tier:** 3.5 · **Size:** M

## UXR-220 — Run kaart als hero (Strava-pattern)

**Tier:** 3.6 · **Size:** L

---

# Dependency graph (samengevat)

```
UXR-001, UXR-002             (geen deps)
        │
        ▼
UXR-010 → UXR-011             (readiness)
UXR-020                       (corridor, standalone)
UXR-030                       (orb, standalone)
        │
        ▼
UXR-040 → UXR-060            (hero + triad)
UXR-050                      (theming, standalone)
        │
        ▼
UXR-100 → UXR-101 → UXR-102   (baseline-engine)
                       │
                       ▼
              UXR-090 (progress)
              UXR-110 (sport correlations)
              UXR-130 (goals)
              UXR-150 (baseline tags)
              UXR-160 (burn bar)

UXR-120 → UXR-121, UXR-122    (journal)

UXR-070, UXR-080, UXR-140     (standalone)
```

---

# Out-of-scope (niet doen)

Zie `PLAN-UX-REDESIGN.md` § *Wat ik adviseer niet te doen*. Light mode, multi-user/social, custom iconenset, native iOS port, splitsen in deel-apps. Deze worden expliciet niet gebackloggd.
