> **Visual references in this plan resolve to the v2 design system.**
> Source of truth: `design/design_handoff_pulse_v2/` (tokens: `tokens.js`,
> screens: `screens/*.jsx`, spec: `README.md`).
>
> Any reference to "Mineral", "light theme", "Inter", or `PULSE-DESIGN-SYSTEM.md`
> in this document is **stale** — substitute the v2 dark tokens. Story intent
> and structure below remain valid.

---

# PLAN-UX-REDESIGN.md

Voorstel voor een gefaseerde UX/UI revisie van Pulse, gebaseerd op een vergelijking met Gentler Streak, Lumy, Strava, Train Fitness, Evolve, Calm, Headspace, Athlytic, Training Today, CHIPR en de visuele taal van Apple Fitness+.

Opgesteld: 2026-04-29.

---

## Hoe dit plan te lezen

Vier tiers, oplopend in tijdsinvestering en risico. Elke tier is op zichzelf zinvol — je kunt na elke tier stoppen en alsnog een betere app hebben dan vandaag.

| Tier | Doel | Tijd | Risico |
|------|------|------|--------|
| **0 — Bugfix** | Login en chat-streaming repareren | ~1 uur | Geen |
| **1 — Quick wins** | Glanceability + tone-of-voice op niveau van Gentler Streak / Athlytic | 1–2 dagen | Klein, geen schema-wijzigingen |
| **2 — Signature** | Pulse een eigen visueel handschrift geven (Apple Fitness+ aesthetic + Athlytic data-DNA) | 3–5 dagen | Middel, raakt design-system |
| **3 — Nieuwe waarde** | Functies die er nu missen (sport-correlaties, coach-rituaal, baseline-engine) | 1–2 weken | Hoger, raakt data-laag |

Aan het eind een aanbevolen volgorde en wat ik adviseer **niet** te doen.

---

# Tier 0 — Bugfixes (vandaag)

Deze zijn al gediagnosticeerd in de chat hierboven; opgenomen voor volledigheid.

## 0.1 Login blijft hangen

**Bestand:** `src/app/auth/login/page.tsx` (regel 29-30) en `src/app/auth/signup/page.tsx`

**Probleem:** `router.push('/')` + `router.refresh()` na `signInWithPassword`. Supabase zet de session-cookie client-side, maar de proxy (`src/proxy.ts:45`) ziet die soms niet op tijd. Tab-wissel forceert een verse request waarop de cookie wel meekomt → vandaar dat het "vanzelf" werkt.

**Fix:** Vervang de twee regels door `window.location.assign('/')`. Volledige page reload garandeert dat de cookie meegaat.

## 0.2 Chat UI is schokkerig

**Bestanden:** `src/components/chat/ChatInterface.tsx`, `src/components/chat/ChatMessage.tsx`

**Drie samenwerkende oorzaken:**

1. `behavior: 'smooth'` scroll op elke chunk (regel 71). Tokens komen ~30/sec binnen → smooth-scroll-animaties stapelen.
2. De `components={{...}}` prop in `ChatMessage.tsx:30-95` is een inline object. Nieuwe referentie elke render breekt elke memoization van `react-markdown`.
3. Auto-scroll vecht met handmatig scrollen — als je naar boven scrollt om iets te lezen, sleurt de effect je weer naar beneden.

**Fix:**
- ChatInterface: scroll-effect splitsen in twee. Voor `messages` (nieuwe message): smooth scroll. Voor `streamingContent`: `'instant'` + rAF-throttle, en alleen als de gebruiker al binnen ~120px van de bodem zit.
- ChatMessage: `components` object naar module-level constante.

**Definition of Done Tier 0:** login werkt eerste keer raak, chat streamt soepel zonder jumps wanneer je leest.

---

# Tier 1 — Quick wins (1–2 dagen)

Geen schema-wijzigingen, geen nieuwe dependencies. Allemaal copy/visuele en kleine logica-aanpassingen die de app *direct* warmer en duidelijker maken.

## 1.1 Eén-zin readiness, niet één-getal

**Inspiratie:** Gentler Streak ("today's a good day for a walk"), Training Today (scenario-aware), Athlytic (hero-getal + reden).

**Nu:** `ReadinessSignal` toont een score zonder context.

**Voorstel:** elke readiness-card bevat **drie regels in deze volgorde**:
1. **Eén Nederlandse zin** geschreven door de coach: *"Slaap was kort (5u 47m) en HRV ligt 14% onder je 60-dagen gemiddelde. Vandaag licht of recovery."*
2. **Eén groot getal** met een ring eromheen (de score) — Apple Fitness+ stijl SF Pro Display, ~64-72pt.
3. **3 kleine stipjes/bars eronder**: slaap, HRV, RHR — elk t.o.v. *jouw* baseline, niet absoluut.

**Bestanden:** `src/components/home/ReadinessSignal.tsx` + nieuwe coach-summary endpoint die op basis van laatste data 1 zin produceert (kan via bestaande `claude-haiku-4-5` voor lage kosten).

**Effort:** S. **Impact:** elke ochtend duidelijk wat je moet doen.

## 1.2 "Stay in the band" voor /belasting

**Inspiratie:** Gentler Streak's Activity Path, Athlytic's Optimal Training Range.

**Nu:** ACWR is een ratio-getal + statuslabel.

**Voorstel:** vervang de zone-bar met een **tijd-as line chart** waar:
- Een lichtgroene band loopt van 0.8 → 1.3 (de optimale ACWR)
- Donkergroene stippellijn = jouw werkelijke ACWR over de laatste 8 weken
- Punten buiten de band krijgen subtiel een rode/oranje tint — geen bordjes, geen alarm

Visueel verandert "ratio" in "een corridor waar je in moet blijven". Metaphor is begrijpelijker en minder beschuldigend dan "OVERTRAINING".

**Bestand:** `src/app/belasting/page.tsx`. Recharts kan dit met een `ReferenceArea` voor de band.

**Effort:** S. **Impact:** ACWR voelt als coaching, niet als verkeerslicht.

## 1.3 Coach Orb (signature visueel element)

**Inspiratie:** Headspace Dot, Calm gradient orb, Lumy circadian theming.

**Nu:** geen visuele identiteit voor de AI-coach. Chat opent in een lege bubble.

**Voorstel:** een kleine SVG-cirkel (~24-40px) die:
- **Pulseert** terwijl Claude streamt (vervangt de huidige `animate-pulse` cursor)
- **Tint mee met readiness**: groen = recovered, amber = caution, rood = at-risk, blauw = neutral/idle
- **Verschijnt overal waar de coach spreekt**: chat header, check-in coach card, homescreen nudge

Eén component, vier vindplaatsen, instant brand recognition.

**Bestand:** nieuwe `src/components/shared/CoachOrb.tsx`. Inzetten in `ChatInterface.tsx`, `CoachAnalysisCard.tsx`, `home/ReadinessSignal.tsx`.

**Effort:** S. **Impact:** app voelt als product, niet als losse pagina's.

## 1.4 Editorial typography voor de home-hero

**Inspiratie:** Apple Fitness+, Strava Stats Stickers.

**Nu:** Homescreen heeft veel cards van vergelijkbaar gewicht.

**Voorstel:** maak één **hero-getal** per dag bovenaan de homepage:
- Op trainingsdag: het volume of zwaarste set die vandaag gepland staat ("**4×8** @60kg DB Bench")
- Op rustdag: slaap-uren of stappen-doel ("**7u 42m** slaap")
- Op check-in dag: aantal sessies in de afgelopen week ("**5/6** sessies deze week")

Eén groot SF Pro Display getal (~96pt), één label (12pt, label-tertiary), klein subtiel ring/bar eronder.

**Bestand:** `src/components/dashboard/DashboardPage.tsx` of een nieuwe `HomeHero.tsx`.

**Effort:** S. **Impact:** elke dag heeft een gezicht; je weet wat de focus is binnen 1 seconde.

## 1.5 Tijd-en-readiness gevoelige achtergrond

**Inspiratie:** Lumy circadiaan UI, Headspace gradient atmosfeer.

**Nu:** dezelfde achtergrond hele dag.

**Voorstel:** `tailwind.config.ts` krijgt 4 gradient-tokens — `time-dawn`, `time-day`, `time-dusk`, `time-night`. Een hook (`useTimeOfDay`) zet ze als CSS variable op `<body>`. Effect: zeer subtiel (5-10% opacity), warmer rond zonsop/onder, koeler 's nachts. Niet de hele app oplichten, alleen de achtergrond.

Optioneel laag: tint mengen met readiness-kleur (groen/amber/rood) voor 1-2% extra warmte.

**Bestand:** `tailwind.config.ts`, `src/app/layout.tsx`, nieuwe `src/hooks/useTimeOfDay.ts`.

**Effort:** S. **Impact:** subtle craft die opvalt zonder dat je hem benoemt.

## 1.6 Suggested questions in chat (goal-driven)

**Inspiratie:** Evolve (goal-driven content), Train Fitness (low-friction start).

**Nu:** chat opent zonder hint. `ChatSuggestions` toont generieke chips.

**Voorstel:** suggesties zijn **dynamisch per actief doel/blessure/coach-memory-item**:
- Als er een lopend doel "lat pulldown 50kg" is → "Hoe sta ik t.o.v. mijn lat pulldown PR?"
- Als er een actieve blessure schouder is → "Welke pull-oefeningen zijn vandaag veilig?"
- Als laatste sessie >3 dagen geleden → "Wat moet ik vandaag trainen?"

Maximaal 3 chips. Aangevuld met 1 vaste: "Bekijk mijn week".

**Bestand:** `src/components/chat/ChatSuggestions.tsx` + endpoint dat suggesties bouwt uit goals/injuries/coaching_memory.

**Effort:** M. **Impact:** chat voelt persoonlijk vanaf seconde 1.

## 1.7 Spaarzaam gebruik van compacte numbers + units

**Inspiratie:** Apple Fitness+ metric tiles, Athlytic's "vs baseline" tags.

**Nu:** sommige cards tonen rauwe nummers ("steps: 8423").

**Voorstel:** alle cards die een enkel getal tonen krijgen een **micro-baseline tag**: 8.423 stappen *↑12% vs 7-dagen*. Achtervoegsel altijd in `text-label-tertiary` en `text-caption2`. Bestaande logic deels al aanwezig in `context-assembler.ts`, hergebruiken voor UI.

**Effort:** S. **Impact:** elk getal heeft betekenis i.p.v. dat het er staat.

---

# Tier 2 — Signature design moves (3–5 dagen)

Hier krijgt Pulse z'n eigen handschrift. Niet meer "een dashboard met cards"; een product dat herkenbaar is.

## 2.1 De Pulse Triad (Train · Recover · Fuel)

**Inspiratie:** Apple Activity Rings, CHIPR's drie-score-model, Athlytic's Recovery vs Exertion overlay.

**Probleem nu:** je moet door 4-5 cards scrollen om "hoe sta ik er vandaag voor" te beantwoorden.

**Voorstel:** drie concentrische ringen (of drie aparte mini-rings) bovenaan de home:

| Ring | Voedt op | Vol bij |
|------|---------|---------|
| **Train** | sessies + tonnage deze week | wekelijks doel |
| **Recover** | slaap + HRV vs baseline | "in band" |
| **Fuel** | eiwit + calorieën vs target | dagelijks doel |

Tap een ring → drilldown naar respectievelijk `/schema`, `/belasting`, `/nutrition`. Vervangt of vult de huidige `WeekAtAGlance` aan.

**Bestanden:** nieuwe `src/components/home/PulseTriad.tsx` (custom SVG met `framer-motion` animatie via `motion`-package die al staat). Centrale data hook `useTriadData`.

**Effort:** M. **Impact:** signature element. Wordt het ding waar mensen over praten als ze de app zien.

## 2.2 Workout-card met heatmap als hero

**Inspiratie:** Strava map-as-hero pattern.

**Probleem nu:** workout-cards in de feed/`WorkoutFeed` tonen titel + duur + count. De *meest interessante* data — welke spieren je raakte — is alleen in `MuscleHeatmap` zichtbaar als wekelijks aggregaat.

**Voorstel:** elke workout-feed-card heeft een **mini muscle heatmap** als hero (silhouette ~120px hoog), met onder:
- Titel + tijdstempel
- Duur + tonnage
- Klein PR-badgeje als er een PR was

Hergebruik `MuscleHeatmap` met een per-workout reduxie (alleen die ene sessie's spieractivatie).

**Bestanden:** `src/components/home/WorkoutFeedCard.tsx`, `src/components/dashboard/MuscleHeatmap.tsx` (variant: `mode="single-session"`).

**Effort:** M. **Impact:** elke session in de feed vertelt direct een verhaal. Sterke visuele identiteit (Pulse = "die met de spier-heatmaps").

## 2.3 Burn Bar voor de wekelijkse check-in

**Inspiratie:** Apple Fitness+ Burn Bar (Behind / In / Middle / Front / Ahead of the Pack).

**Probleem nu:** check-in zegt "5 sessies deze week, ACWR 1.34". Niet motiverend.

**Voorstel:** een 5-tier visueel:
- **Achterstand**
- **Op stoom**
- **In ritme**
- **Voor de troepen uit**
- **Topweek**

Genormaliseerd t.o.v. *jouw* laatste 4-8 weken (geen population baseline). Eén horizontale bar met je positie als ronde marker. Onderaan klein label "vs jouw 4-weken gemiddelde".

**Bestand:** nieuwe `src/components/check-in/WeekTier.tsx`, geïntegreerd in `WeekReviewCard.tsx`.

**Effort:** S. **Impact:** elke week heeft een gevoels-uitkomst, niet alleen cijfers.

## 2.4 Coach Ritual op homescreen

**Inspiratie:** Calm "Daily Calm" (één hero-ritueel), Headspace daily session card.

**Probleem nu:** homescreen heeft check-in nudge, readiness, week-glance, muscle map, daily health bar. Veel "wat" en weinig "wat doe ik nu".

**Voorstel:** één **Today's Move** card boven al het andere — een rituele dagelijkse handeling:
- Maandag/Donderdag: "Kantoordag — fiets-warming up bij aankomst"
- Trainingsdag: "Upper A — vandaag 06:30 Train More"
- Rustdag: "Recovery walk — 30 min in de zon"
- Check-in zondag: "Tijd voor je weekreview"

Card is groot (~50% schermhoogte mobiel), volledige breedte, met een hero illustratie of subtle background image. Eén actie-knop ("Open schema" / "Start check-in"). Alle andere cards onder de fold.

**Bestand:** nieuwe `src/components/home/TodaysMove.tsx`. Logica: AI bepaalt welke ritueel-tekst gegenereerd wordt (één call per dag, gecached in `coaching_memory`).

**Effort:** M. **Impact:** sterk anker — gebruiker opent app en weet meteen "wat moet ik nu".

## 2.5 Tonnage trend + body composition trend chart

**Inspiratie:** Athlytic before/after fitness card, Strava elevation graph.

**Probleem nu:** `/progress` toont een per-oefening line chart. Body composition is een statische card zonder trend.

**Voorstel:**
- **Tonnage line chart** per week (8 weken default) — toont totaal volume, met markers waar trainingsblokken begonnen/eindigden
- **Body comp 4-week sparkline** in homescreen body comp card: gewicht, vetmassa, spiermassa elk een micro-line; getal links, sparkline rechts. Compositie-bar (%vet/%spier) eronder.

**Bestanden:** `src/app/progress/page.tsx` uitbreiden, `src/components/home/BodyCompositionCard.tsx` (zo niet aanwezig — toevoegen).

**Effort:** M. **Impact:** je voelt de progressie. Vandaag is body comp een "hier zijn de cijfers" — wordt "hier is de richting".

## 2.6 Schema-overview met set/rep peek

**Inspiratie:** Strava activity card hierarchy (overview → drill).

**Probleem nu:** `/schema` toont workout-cards met alleen titel en focus. Je moet erop tappen voor de oefeningen.

**Voorstel:** elke schema-card heeft een **collapsible peek** — eerste 3 oefeningen + "+2 meer" als er meer zijn. Tap = expand inline (geen modal). Tweede tap = de huidige drill-down sheet voor full edit.

**Bestand:** `src/app/schema/page.tsx`, `src/components/dashboard/MuscleDrilldownSheet.tsx`.

**Effort:** S. **Impact:** je kunt je hele week zien in één glimp i.p.v. 7 keer tappen.

---

# Tier 3 — Nieuwe waarde (1–2 weken)

Functionaliteit die er vandaag niet is, met datalaag-impact.

## 3.1 Personal baseline engine

**Inspiratie:** Athlytic, Training Today, CHIPR — overal "vs jouw baseline".

**Probleem nu:** veel kaarten tonen absolute getallen ("HRV 52ms"). Voor één persoon over tijd zegt dat weinig — context is altijd: hoe sta je t.o.v. jezelf van 4 weken geleden.

**Voorstel:** een gedeelde service `src/lib/baselines/` die voor elke metric (slaap, HRV, RHR, gewicht, ACWR, eiwit, tonnage) een **30-dagen rolling baseline** + **60-dagen baseline** + **jaar-baseline** bewaart in een nieuwe table `metric_baselines`. Daily cron job aggregeert. Alle UI-cards die een metric tonen krijgen een baseline-helper die de juiste t-tag genereert: *↑12% vs 30d, ↓4% vs 60d*.

**Schema:**
```sql
CREATE TABLE metric_baselines (
  user_id UUID,
  metric TEXT,             -- 'sleep_hours', 'hrv_rmssd', etc
  date DATE,
  value_30d_avg NUMERIC,
  value_60d_avg NUMERIC,
  value_365d_avg NUMERIC,
  PRIMARY KEY (user_id, metric, date)
);
```

Cron-job in `src/app/api/cron/daily-aggregate/route.ts` uitbreiden.

**Effort:** L. **Impact:** elk getal in de hele app krijgt context. Onderbouwing voor élke andere Tier 1/2 fix.

## 3.2 Sport-correlaties en cross-sport fatigue

**Inspiratie:** geen enkele referentie-app doet dit goed; dit is Pulse's kans op uniciteit.

**Probleem nu:** Pulse tracked gym + run + padel maar laat geen interactie zien. *"Padel maandag = squat dinsdag voelt 10% zwaarder"* is precies het soort coaching dat een mens-coach geeft maar geen app.

**Voorstel:** een **cross-sport correlation panel** op `/belasting`:
- Per sport een fatigue-score (0–100) op basis van laatste 72u
- Een gestapelde bar: gym + run + padel = totale belasting
- Een tekst-insight: *"Maandag padel + dinsdag squat dag is jouw zwaarste 24u-block. Overweeg padel naar zaterdag."*

AI genereert de insights wekelijks (cron job, opgeslagen in `coaching_memory`).

**Bestanden:** uitbreiding `src/app/belasting/page.tsx`, nieuwe service `src/lib/load/sport-correlations.ts`.

**Effort:** L. **Impact:** *het* differentiator-argument. Nergens anders te krijgen.

## 3.3 Coaching Memory feed

**Inspiratie:** Headspace's content history, Calm's reflection journal.

**Probleem nu:** `coaching_memory` table is alleen via raw JSON in settings te zien. AI schrijft erin maar gebruiker ziet nooit terug wat de coach onthoudt.

**Voorstel:** nieuwe pagina `/journal` (of tab in `/settings`) die de memory leesbaar toont, gegroepeerd per categorie (program, lifestyle, injury, preference, pattern, goal). Per item: tekst, datum, "edit" of "verwijder" knop. Optioneel: zoekbalk + filter op datum.

Plus een **"Lessons learned" feed**: AI schrijft elke wekelijkse check-in 1–2 lessen weg in een nieuwe table `weekly_lessons`. Op het journal verschijnen die als tijdlijn.

**Bestand:** nieuwe `src/app/journal/page.tsx`. Schema migration voor `weekly_lessons`.

**Effort:** M. **Impact:** transparantie + retentie. Je voelt dat de coach je kent.

## 3.4 Goals praten met training-data

**Inspiratie:** geen specifiek; gezond verstand.

**Probleem nu:** goals tabel staat los. *"Lat pulldown naar 50kg"* heeft geen visueel verband met de PR-table of recente sessies.

**Voorstel:** elk goal krijgt — als het traint-gerelateerd is — een **automatische progress-feed**:
- Auto-detect: "lat pulldown 50kg" → koppelen aan exercise_definition `lat pulldown`
- Op de goal-card: laatste 6 sessies' best-set sparkline
- Wekelijks coach-bericht in de chat: "Je zit nog 7.5kg af van je lat pulldown doel. Vorige week pakte je 42.5kg×8."
- Als je het haalt: confetti-moment + AI-coach feliciteert + auto-archiveer goal.

**Bestand:** uitbreiding `src/components/goals/GoalCard.tsx`, nieuwe service `src/lib/goals/auto-link.ts`.

**Effort:** M. **Impact:** doelen voelen levend in plaats van een afvinklijstje.

## 3.5 Quick check-in (30 sec)

**Inspiratie:** Calm's "1-minute breathe", Headspace's micro-meditations.

**Probleem nu:** `/check-in` is een 4-stappen flow. Te zwaar voor "even snel".

**Voorstel:** een **bottom-sheet quick check** vanaf het homescreen:
- Slider: "Hoe voel je je? 1–5"
- Slider: "Hoe goed sliep je? 1–5"
- Eén tekst-veld: "Iets toe te voegen?" (optioneel)

Sla op in een nieuwe table `daily_checkins`. AI verwerkt 's avonds in `coaching_memory`. Volwaardige `/check-in` blijft bestaan voor zondag.

**Bestand:** nieuwe `src/components/home/QuickCheckIn.tsx`, nieuwe API route `/api/check-in/quick`.

**Effort:** M. **Impact:** dagelijkse inputloop, niet wekelijks. AI heeft meer signal om mee te coachen.

## 3.6 Run kaart als hero (Strava-pattern)

**Inspiratie:** Strava map-as-hero.

**Probleem nu:** run-data komt binnen via Apple Health maar GPS-route niet. Run-cards in de feed zijn tekst-gebaseerd.

**Voorstel:** als `runs.route_geojson` bestaat (nieuw veld via Health Auto Export GPX export of ingest), render een mini-map op de feed-card. Tap = grote routekaart op `/workouts/[id]` of nieuwe `/runs/[id]`.

Vergt: ingest-pipeline uitbreiding voor GPX/route data, mapbox/maplibre dependency, schema-veld toevoegen.

**Effort:** L. **Impact:** runs voelen visueel rijk; nu zijn ze de "tekst-stiefkindjes" van de app.

---

# Wat ik adviseer **niet** te doen

- **Light mode toggle.** Dark theme is een design choice, niet een ontbrekende feature. Geen prioriteit.
- **Multi-user / social.** Pulse is bewust single-user. Strava-style feeds kosten tijd en voegen niets toe voor jouw use-case.
- **Volledig nieuwe iconenset.** Lucide-react werkt; ga geen tijd in custom icons steken. Wel: vervang generieke icons in de coach-context met een handvol gerichte symbolen (de Coach Orb is genoeg).
- **Splitsen in trainer-app + nutrition-app.** Een van Pulse's krachten is dat alles bij elkaar staat. Niet uit elkaar trekken.
- **Native iOS app porten.** PWA-route is goed gekozen; verdubbeling van werk om hetzelfde resultaat.

---

# Aanbevolen volgorde

| Sprint | Tier | Inhoud | Waarom in deze volgorde |
|--------|------|--------|-------------------------|
| **Sprint 0 (vandaag)** | T0 | Login + chat-jitter fix | Blokkeert dagelijks gebruik |
| **Sprint 1 (deze week)** | T1.1 + T1.2 + T1.3 | Eén-zin readiness + corridor + Coach Orb | Onderkant van Pulse's coaching-claim. Direct voelbaar verschil. |
| **Sprint 2** | T1.4 + T1.5 + T2.1 | Hero-getal + tijd-thema + Triad | Nieuwe homescreen-identiteit |
| **Sprint 3** | T3.1 (baseline-engine) | Foundation | Onderlaag voor alle "vs baseline" tags. Geen UI maar kritiek. |
| **Sprint 4** | T2.2 + T2.4 + T2.5 | Workout heatmap-card + Today's Move + tonnage trend | Visuele rijkheid in feed + duidelijk dagelijks anker |
| **Sprint 5** | T3.2 + T3.3 | Sport-correlaties + Coaching Memory feed | De features die Pulse uniek maken |
| **Sprint 6** | T1.6 + T1.7 + T2.3 + T3.4 | Suggested questions + tier-based check-in + goals-koppeling | Polishing |
| **Later** | T2.6 + T3.5 + T3.6 | Schema-peek + quick check-in + run maps | Nice-to-have |

---

# Definition of Done — gehele plan

Een gebruiker die Pulse voor het eerst opent op een trainingsdag ziet:

1. Een hero-anker dat zegt **wat hij vandaag moet doen** (Today's Move)
2. Een **drie-ring Triad** die in 1 oogopslag z'n week en herstel toont
3. Een **één-zin coach-uitspraak** met de pulserende Coach Orb naast de tekst
4. Een **subtiel circadiaans warmer wordende achtergrond** als de dag vordert
5. Bij het tappen op elke metric: **vs jouw 30/60-dagen baseline**, niet absoluut
6. Bij elke afgesloten sessie: een **muscle heatmap als hero** + voor/na fitness shift
7. Bij /belasting: een **corridor met je traject erdoor**, geen verkeerslicht
8. Bij /chat: **goal-driven suggesties**, een orb die meeleeft, soepel scroll-gedrag
9. Bij weekly check-in: een **tier-uitkomst** ("In ritme" / "Voor de troepen uit") in plaats van rauwe cijfers
10. Bij goals: **levende koppeling met PR's** en wekelijkse coach-feedback

Pulse moet voelen als één product met een eigen handschrift, geen verzameling van losse pagina's met cards. De referentie is Apple Fitness+ in *uitstraling*, Athlytic in *data-DNA*, Gentler Streak in *toon*, Headspace in *micro-craft*.

---

# Keuzes voor jou

Voordat ik begin met implementeren, drie open keuzes:

**A. Visueel handschrift bij Tier 2** — Pulse heeft op dit moment Apple HIG dark-theme als basis. Wil je richting:
- **Strakker iOS-native** (huidige richting versterken: SF Pro, glassy, cool)
- **Editorial-Apple Fitness+** (gradients, full-bleed, warmer)
- **Calm-warm** (subtiele organic gradients, zachter)

Mijn voorstel: editorial-Fitness+ omdat het Pulse onderscheidt zonder de dark-theme te verlaten.

**B. Coach Orb-personaliteit** — kleur-tinting:
- **Functional** (groen/amber/rood = readiness)
- **Warm-only** (één kleur, alleen pulserend)
- **Atmospheric** (kleur-shift met tijd van dag, zoals Lumy)

Mijn voorstel: Functional. Dubbele functie (signature + status).

**C. Tier 3 prioritering** — als je niet alles van Tier 3 wilt, welke twee:
- 3.1 (baseline-engine) — tech foundation
- 3.2 (sport-correlaties) — uniek differentiator
- 3.3 (coaching memory feed) — transparantie
- 3.4 (goals-koppeling) — engagement
- 3.5 (quick check-in) — daily loop
- 3.6 (run maps) — visueel

Mijn voorstel: 3.1 + 3.2. Foundation + uniciteit.

Laat weten wat je van het plan vindt en op welke keuzes je wilt sturen — dan beginnen we met Sprint 0.
