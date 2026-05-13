# Pulse UI/UX Audit — Fase 3

**Scope:** alle routes in `src/app/**/page.tsx`, bijbehorende componenten in `src/components/`, `src/lib/motion-presets.ts`, en design tokens in `pulse/design/design_handoff_pulse_v2/`.

**Methodiek:** code-level review. Geen visuele screenshots — alles gededuceerd uit Tailwind classes, component structuur, en de handoff spec.

---

## Route-voor-route analyse

### `/` — Home (DashboardPage)

**Visuele hiërarchie (top → bottom):**

```
1. Begroeting (h1, text-title1, 28px bold)
2. CheckInBadge — conditioneel (Sa/Su/Ma), verbergt na review
3. ReadinessSignal — gekleurde banner, coaching-zin, metrics
4. TodayWorkoutCard — workout/rustdag kaart met oefeningen
5. WeekAtAGlance — 7 pillens weekoverzicht
6. DailyHealthBar — stappen / HR / HRV / slaap grid
7. MuscleMapCard — heatmap + volumerangen + activiteiten
8. SyncButton — onderaan
```

**Eerste 2 seconden:** goed. Begroeting + ReadinessSignal vormen een duidelijk "hoe sta ik ervoor vandaag" antwoord. De coaching-zin staat hoog genoeg. CheckInBadge krijgt prioriteit boven ReadinessSignal op check-in-dagen, wat correct is.

**Findings:**

1. **ReadinessSignal rendert `null` tijdens laden (DashboardPage.tsx:110).** De HomeSkeleton bevat geen placeholder voor dit element. Wanneer `schemaLoading` klaar is maar `useReadiness` nog bezig is, verschijnt de rest van de pagina al en springt ReadinessSignal dan alsnog in. Dit veroorzaakt layout shift op het meest prominente element. Fix: voeg een SkeletonCard toe in HomeSkeleton ter hoogte van de readiness-banner, óf geef ReadinessSignal een eigen skeleton staat in plaats van `null`.

2. **MuscleMapCard staat te ver naar beneden in de hiërarchie.** Dit is het meest content-rijke element op de pagina (heatmap + bars + activiteiten = potentieel 500px+). Op een 390px breed scherm begint het pas na drie andere kaarten. In combinatie met de SyncButton helemaal onderaan — die tot de zichtbare fold behoort op geen enkel scherm — ontbreekt er een visuele afsluiting. Overweeg SyncButton te integreren in de header of in een overflow-menu. MuscleMapCard kan eventueel worden samengevouwen tot een kleinere "kaart" met expand-interactie.

3. **Geen empty state voor volledig nieuwe gebruiker.** Als `schemaWeek` retourneert zonder `days` en alle overige hooks geen data teruggeven, worden stap voor stap de kaarten onzichtbaar (returns `null`). TodayWorkoutCard retourneert `null` bij ontbrekende dag (TodayWorkoutCard.tsx:87), WeekAtAGlance rendert niet bij ontbrekend schemaWeek (DashboardPage.tsx:124), DailyHealthBar retourneert `null` zonder data (DailyHealthBar.tsx:65), MuscleMapCard toont een eigen empty-state maar is daarvoor een lange scroll. Het resultaat voor een nieuwe gebruiker: een begroeting, CheckInBadge (waarschijnlijk ook niet), ReadinessSignal (ook null), en dan leegte. Er moet een gestructureerde "dag-één" empty state zijn op `/`, niet een cascade van null-renders.

---

### `/schema` — Trainingsschema

**Visuele hiërarchie:**

```
1. "Schema" (h1, text-title1)
2. SchemaProgress — blok-voortgang, progress bar, sessies
3. SchemaOverview — collapsible oefenlijst per dag
4. SchemaCalendar — weken-agenda met drag/reschedule
5. PlanWeekModal — Google Calendar koppeling
```

**Findings:**

1. **SchemaPageContent.tsx:66 — de empty state bij ontbrekend schema linkt correct naar `/chat`, maar de beschrijving "Maak een schema via de Coach of voeg er een toe in de instellingen" is vaag.** Een nieuwe gebruiker weet niet dat de Coach een schema kan genereren. Concretere copy: "Vraag de Coach: 'Maak een 4-weekse Upper/Lower schema voor mij'" — inclusief een voorbeeldprompt.

2. **pb-24 op de pagina-wrapper (`schema/page.tsx:5`) en pb-[83px] op de layout-main.** Dubbele bottom padding. De layout voegt al `pb-[83px]` toe voor de tab bar (layout.tsx:39). De schema-pagina voegt daar nog eens `pb-24` (96px) aan toe. Totaal: ~180px lege ruimte onderaan. Audit alle routes: `/progress`, `/goals`, `/belasting`, `/nutrition` hebben ook `pb-24`. Dit is slordig en verspilt screen real estate op mobiel.

3. **SchemaCalendar heeft een backdrop-div met `onClick={onClose}` (SchemaCalendar.tsx:96), geen `role` of `aria-label`.** Dit is een niet-semantisch klikbaar element. Voeg `role="button"` toe met `aria-label="Sluiten"`, of gebruik een echte `<button>`.

---

### `/chat` — Coach

**Visuele hiërarchie:**

```
1. Header bar met "Coach" + "Nieuwe sessie" knop
2. Lege staat: "Stel een vraag of log een maaltijd" (gecentreerd)
3. ChatSuggestions — 3 contextgevoelige pills
4. ChatInput — textarea + send-knop
```

**Findings:**

1. **ChatPage.tsx:28 — de "Nieuwe sessie" knop heeft `py-1.5` wat neerkomt op ~6px verticaal padding + 12px tekst = ~24px raakhoogte. Dat is ver onder de 44px minimum.** De knop zit in de header op de plek waar een vinger nauwelijks precies kan tikken. Fix: `py-2.5 px-4` of geef het element `min-h-[44px]`.

2. **Geen CoachOrb.** De handoff-spec (README.md:238–250) definieert de `CoachOrb` als hét visuele ankerpunt voor alle AI-interacties: Header /, Chat-bubbels, insights. De huidige implementatie heeft alleen "Coach" als tekstlabel. Het ontbreken van de CoachOrb is de meest significante afwijking van de v2 design-spec in de hele codebase.

3. **ChatSuggestions.tsx:3 — suggesties zijn hard-coded op weekdag, niet op gebruikerscontext.** Whoop en de Apple Fitness+ app sturen vandaag-relevante nudges. Maandag toont altijd "Wat train ik vandaag?" — maar als de gebruiker vandaag al getraind heeft (dag status = completed), is die suggestie irrelevant. Koppel dit aan `useSchemaWeek` zodat de suggestions dynamisch worden: "Je hebt vandaag Upper A gedaan — hoe was het?" als de workout completed is.

---

### `/progress` — Progressie

**Visuele hiërarchie:**

```
1. "Progressie" (h1)
2. ExercisePicker — dropdown/lijst voor oefening selectie
3. ProgressionChart — lijndiagram gewichtsprogressie
4. PRList — persoonlijke records
5. BodyComposition — lichaamssamenstelling kaart
```

**Findings:**

1. **ProgressPage.tsx:39 — eerste oefening wordt automatisch geselecteerd via `useEffect`.** Dit is goed voor UX, maar de volgorde van laden is: pagina toont eerst skeleton → oefeningen laden → auto-select → chart laadt. Dit zijn drie visuele transities in één flow. Overweeg een URL-parameter (`?exercise=Bench+Press`) zodat de selectie persistent is en direct laadt.

2. **`hasData` check op ProgressPage.tsx:75 combineert PRs en exercises.** Als een gebruiker exercises heeft maar geen PRs, of PRs maar geen exercises, kan de pagina onterecht een EmptyState tonen of onterecht doorgaan. De huidige check `(progressData?.personalRecords.length ?? 0) > 0 || exercises.length > 0` is correct maar de EmptyState tekst "Start met trainen en je voortgang verschijnt hier" is incorrect als de gebruiker wel exercises heeft maar de PR-berekening gefaald is. Dit is een edge-case die visueel verwarrend kan zijn.

3. **BodyComposition staat altijd onderaan, zonder conditionele rendering.** Als een gebruiker geen Apple Health data heeft, laadt BodyComposition met zijn eigen laadindicator maar geeft een lege staat. Dit voelt als een broken card op de pagina. Wrap het in een check die de card alleen rendert als er body composition data beschikbaar is.

---

### `/check-in` — Wekelijkse check-in

**Visuele hiërarchie:**

```
1. Terug-knop + "Week X" header + datumrange
2. StepIndicator (4 stappen)
3. Stap-inhoud (Review / Analyse / Planning / Bevestig)
```

**Findings:**

1. **CheckInFlow.tsx:80 — de terug-knop op stap 1 (h-8 w-8 = 32px)** is kleiner dan 44px. De `ChevronLeft` in een 32px container met `rounded-full bg-system-gray6` geeft een tapbaar vlak van 32px. Fix: verander naar `h-11 w-11` (44px).

2. **Stap-indicator is goed gebouwd, maar de labels ("Review · Analyse · Planning · Bevestig") zijn alleen zichtbaar als tekst naast een cirkel.** Op een iPhone SE (375px breed) passen vier stap-items met labels nauwelijks. Geen `overflow-x: auto` of responsive fallback aanwezig. Check op kleine schermen.

3. **CheckInFlow.tsx:181 — de logica `data.previousReview === null && confirmed` is dood code.** De conditie wordt gechecked maar leidt naar geen rendering (`// Show success — will also match after confirm`). Dit is een commentaar-overlevering van een eerdere versie. Verwijderen voor clarity.

---

### `/goals` — Doelen

**Visuele hiërarchie:**

```
1. "Doelen" (h1) + "Doel toevoegen" knop
2. GoalForm (conditioneel, inline)
3. Actieve doelen — GoalCard lijst
4. Voltooide doelen — collapsed toggle
```

**Findings:**

1. **GoalsPage.tsx:47 — de "Doel toevoegen" knop heeft `py-2` wat neerkomt op ~8px padding + 14px tekst = ~30px raakhoogte.** Zie dezelfde issue als op /chat. Fix: minimaal `py-3`.

2. **Geen loading skeleton voor de pagina-titel.** De `GoalsSkeleton` (GoalsPage.tsx:128) rendert alleen de kaarten, niet de header. Bij laden ziet de gebruiker de header al (inclusief "Doel toevoegen" knop) terwijl de content nog skeletons zijn. Inconsistent met de aanpak op Home en Schema.

3. **GoalsPage.tsx — `error` state (regel 55) rendert een ErrorAlert maar de pagina toont nog steeds de header en (lege) skeleton.** Als laden mislukt, ziet de gebruiker een lege pagina met een foutmelding halverwege, niet een gecentraliseerde foutpagina. Gebruik dezelfde patroon als ProgressPage.tsx:66 — return early met een gecentraliseerde error view.

---

### `/belasting` — Workload

**Visuele hiërarchie:**

```
1. Terug-link naar /
2. "Belasting" (h1, large-title 34px)
3. Status + ZoneBar kaart
4. Acute/Chronic load grid
5. Trend sparkline (6 weken)
6. Educatieve legenda
```

**Findings:**

1. **WorkloadPage.tsx:120 — skeleton rendert conditioneel naast `data` en `error` checks, maar niet als vroege return.** De structuur `{isLoading && <Skeleton>} {error && <ErrorAlert>} {data && <content>}` staat in één return-boom. Dit is functioneel correct, maar bij een error toont de pagina de header + terug-link al, wat inconsistent is met andere pagina's. Geen structurele issue, maar onnodig als alle drie states tegelijk kunnen renderen bij race-conditions (theoretisch).

2. **De terug-link (`-ml-2 flex w-fit items-center`) heeft geen minimale raakhoogte.** De tappable area van een `<Link>` die een `ChevronLeft` (24px) + "Terug" tekst bevat is ongeveer 24–28px hoog. Niet 44px. Fix: `py-3` toevoegen aan de link, of wrapper aanpassen naar `min-h-[44px]`.

3. **Belasting is niet bereikbaar via de bottom nav.** Het is een sub-pagina bereikbaar via de ACWR-link op de ReadinessSignal kaart (ReadinessSignal.tsx:135). Dat is slimme context-linking, maar Belasting is een van de meest waardevolle analytische schermen van de app. Overweeg het opnemen in een "Meer" sectie of via een persistent entry point op de progress pagina.

---

### `/nutrition` — Voeding

**Visuele hiërarchie:**

```
1. "Voeding" header + datum-navigatie (pijl links/rechts)
2. NutritionInput — tekstinvoer voor maaltijdlogging
3. DayIndicator — calorie/proteïne status
4. MacroSummary + ProteinTracker (conditioneel bij data)
5. MealsList
```

**Findings:**

1. **NutritionPage.tsx:104 — de NutritionInput staat bóven de dagsamenvatting.** Op Whoop en MyFitnessPal staat het invoerveld onderaan (als keyboard-dicht-gebruik), met de samenvatting bovenaan. Hier ziet de gebruiker eerst een inputveld voordat hij weet hoe zijn dag er al uitziet. Swap de volgorde: DayIndicator en MacroSummary eerst, NutritionInput onderaan (anchor-to-bottom bij scroll).

2. **Geen skeleton voor NutritionInput zelf.** De `NutritionSkeleton()` rendert een donut-placeholder en maaltijdlijst, maar NutritionInput is al zichtbaar terwijl de rest laadt. Dit creëert een gat in de skeleton-flow waarbij de gebruiker al kan typen terwijl data nog ophalen is.

3. **Datum-navigatie (ChevronLeft/Right buttons) heeft `min-h-[44px] min-w-[44px]` (NutritionPage.tsx:84, 93).** Dit is correct — een van de weinige plaatsen in de codebase waar 44px tap targets expliciet gespecificeerd zijn.

---

### `/settings` — Instellingen

- Enige route met `<Suspense>` wrapper op pagina-niveau (settings/page.tsx:6). Patroon dat ook voor `/progress` en `/nutrition` zou moeten gelden.
- Geen verdere analyse van SettingsPage.tsx op deze sprint — handoff README markeert dit als lagere prioriteit na Home/Schema/Progress.

---

## Cross-cutting issues

### 1. Design system — token-migratie niet gestart

De v2 handoff-spec (README.md) definieert een volledig nieuw token-systeem: `sport-gym-base` (#00E5C7), `sport-run-base` (#FF5E3A), `bg-bg-page` (#15171F), `text-text-primary` (#F5F5F7), `brand-claude` (#D97757). De huidige `globals.css` implementeert nog het Apple HIG v1 systeem: `system-blue`, `system-green`, `system-gray6`, etc. Er zijn **316 verwijzingen** naar v1-tokens in de component-bestanden. De v2-tokens zijn nergens in de Tailwind config of CSS gedefinieerd.

**Gevolg:** de app draait momenteel op Apple HIG iOS-kleuren (blauw accenten, iOS groen, iOS oranje) in plaats van de v2 sport-accenten (teal voor gym, rood-oranje voor run, amber voor padel). De `CoachOrb` (coral `#D97757`) bestaat nog niet als component.

**Concreet verschil:** WeekAtAGlance.tsx gebruikt `bg-system-blue` voor gym-activiteiten (regel 44), terwijl de spec `sport-gym-base #00E5C7` (teal) vereist. Dit is niet een subtiel verschil — het is een fundamenteel andere visuele taal.

### 2. Dubbele bottom padding

`layout.tsx:39` voegt `pb-[83px]` toe aan alle pagina's voor de tab bar. Vervolgens voegen schema/page.tsx, progress/ProgressPage.tsx, goals/GoalsPage.tsx, nutrition/NutritionPage.tsx, en belasting/WorkloadPage.tsx elk `pb-24` (96px) toe. Dit resulteert in ~180px lege ruimte onderaan elke pagina op mobiel. De layout-padding is bedoeld als enige bottom clearance. Verwijder `pb-24` van alle route-pagina's.

### 3. Safe area — themeColor fout

`layout.tsx:26` zet `themeColor: '#F2F2F7'` — dat is de iOS light-mode achtergrond. De app is dark-only. Op iOS toont de statusbalk daarboven een lichte kleur terwijl de app donker is. Correct: `themeColor: '#15171F'` (v2 bg.page) of `'#000000'`.

Geen `pb-safe` of `env(safe-area-inset-bottom)` in de codebase. De Navigation-component hard-codet `pb-[34px]` als home-indicator clearance, wat werkt voor iPhone X+ maar niet correct schalen bij nieuwe form factors. Tailwind heeft `pb-safe` via de `@tailwindcss/typography` configuratie — overweeg dit te adopteren.

### 4. Focus rings — keyboard nav

`outline-none` staat op alle `<input>` en `<textarea>` elementen (signup/page.tsx:59, login/page.tsx:51, ChatInput.tsx:52, OnboardingWizard.tsx:42). Er is geen vervangende `focus-visible:ring-*` stijl. Schema-inputs op EditWeekModal.tsx:198 en SchemaExerciseList.tsx:60 gebruiken `focus:border-system-blue` — tenminste een visuele indicatie, maar niet een ring. Voor keyboard-gebruikers en screenreaders is dit een WCAG 2.4.11 (Focus Appearance) schending.

### 5. Animaties — listContainer stagger

`motion-presets.ts:51` — de `listContainer` variant heeft geen `initial` variant — alleen een `animate` met stagger-children. Dit werkt omdat de `listItem`-kinderen hun eigen `initial: { opacity: 0, y: 6 }` hebben. Maar `listContainer` op DashboardPage.tsx:91 gebruikt `initial="initial"` en `animate="animate"` — dit werkt dus alleen als de kinderen ook de `listItem` variant gebruiken. Als je ooit een kind mist, zal het niet animeren maar ook niet crashen. Het ontbreken van een `initial` op `listContainer` is een stille bug-aanbieder. Voeg toe: `initial: {}`.

### 6. Navigation — deprecated color classes

`Navigation.tsx:46` gebruikt `bg-white/72 dark:bg-[#1C1C1E]/72` voor de tab bar achtergrond. De app heeft geen `dark:` class op de html-element (globals.css:148 zet `color-scheme: light`). De dark-mode variant wordt dus nooit geactiveerd tenzij de gebruiker system dark mode aan heeft EN de html-element `.dark` klasse krijgt. In de praktijk is de bottom nav altijd light-mode wit/transparant. Dat is onjuist voor een dark-only app. Gebruik `bg-[#1C1C1E]/72` direct.

---

## 5 ASCII mockup-suggesties

### Mockup 1 — Home: nieuwe gebruiker empty state

```
┌─────────────────────────────────┐
│ Goedemorgen, [naam]            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  ⚡ Aan de slag             │ │
│ │                             │ │
│ │  Koppel je data bronnen om  │ │
│ │  Pulse te laten werken.     │ │
│ │                             │ │
│ │  [ Hevy koppelen ]          │ │
│ │  [ Apple Health koppelen ]  │ │
│ │  [ Schema aanmaken →/chat ] │ │
│ └─────────────────────────────┘ │
│                                 │
│  (geen losse null-kaarten)      │
└─────────────────────────────────┘
```

**Rationale:** vervangt de huidige waterval van null-renders. Eén kaart, drie acties, duidelijke richting.

---

### Mockup 2 — Home: ReadinessSignal met skeleton

```
Huidig (isLoading = false, readiness nog aan het laden):
┌─────────────────────────────────┐
│ Goedemorgen, Stef               │
│  [leeg — geen banner]           │
│  [TodayWorkoutCard al zichtbaar]│
└─────────────────────────────────┘

Gewenst (skeleton placeholder):
┌─────────────────────────────────┐
│ Goedemorgen, Stef               │
│ ┌─────────────────────────────┐ │
│ │  ░░░░░░░░░░  ░░░░░░░░       │ │  ← skeleton banner, ~56px hoog
│ │  ░░░░░░░░░░░░░░░░░░░░░░░    │ │
│ └─────────────────────────────┘ │
│  [TodayWorkoutCard]             │
└─────────────────────────────────┘
```

---

### Mockup 3 — Chat: CoachOrb + grotere "Nieuwe sessie" knop

```
Huidig:
┌──────────────────────────────────┐
│ Coach           [Nieuwe sessie]  │  ← ~24px tap target
└──────────────────────────────────┘

Gewenst (v2 spec):
┌──────────────────────────────────┐
│  🟠 Pulse Coach    [+ Nieuw]     │  ← CoachOrb links, knop 44px min
│                                  │
│  (coral #D97757 orb, 32px)       │
└──────────────────────────────────┘
```

---

### Mockup 4 — Nutrition: invoer onderaan, data bovenaan

```
Huidig:
┌──────────────────────────────────┐
│  Voeding         ← Vandaag →    │
│  [NutritionInput — invulveld]   │  ← eerste wat je ziet
│  DayIndicator                   │
│  MacroSummary                   │
│  MealsList                      │
└──────────────────────────────────┘

Gewenst (Whoop/MFP patroon):
┌──────────────────────────────────┐
│  Voeding         ← Vandaag →    │
│  DayIndicator — calorie ring    │  ← eerste: hoe sta ik ervoor?
│  MacroSummary                   │
│  MealsList                      │
│  ─────────────────────────────  │
│  [NutritionInput]               │  ← onderaan, dicht bij keyboard
└──────────────────────────────────┘
```

---

### Mockup 5 — Check-in: terug-knop 44px + stap-indicator responsive

```
Huidig (step indicator op 375px):
[1 Review] — [2 Analyse] — [3 Planning] — [4 Bevestig]
 (labels krap, mogelijke overflow)

Gewenst:
┌──────────────────────────────────┐
│ ← (44px tap target)  Week 20    │
│ 3 mei – 9 mei                   │
│                                 │
│  ●━━━●━━━○━━━○                  │
│  1   2   3   4                  │  ← cirkels zichtbaar, labels weg op
│                                 │     kleine schermen (sm:hidden labels)
└──────────────────────────────────┘
```

---

## Onboarding-flow analyse

**Pad:** `/auth/signup` → `OnboardingWizard` (modal op `/`) → eerste workout

### Stap-voor-stap:

1. **`/auth/signup`** — naam + email + wachtwoord formulier. Redirect naar `/` na signup. Geen e-mailverificatiestap (Supabase is geconfigureerd zonder confirm, of de user wordt direct ingelogd). Formulier is functioneel maar kaal: geen Pulse logo buiten de tekst, geen value proposition ("Jouw persoonlijke trainingscoach").

2. **`OnboardingCheck` → `OnboardingWizard`** — Server component op layout-niveau checkt `display_name`. Als leeg: toont de wizard als fullscreen-modal. Wizard heeft 4 stappen: Profiel → Sporten → Koppelingen → Doelen.

3. **Stap 3 "Koppelingen"** is het pijn-punt: de gebruiker moet hun Hevy API key en Health Auto Export token invoeren in een password-veld, met alleen een verwijzing naar "Hevy → Instellingen → API". Geen link, geen QR-code, geen deep-link. Dit is de grootste drop-off in de onboarding — de gebruiker moet de app verlaten om hun API key te vinden, en als ze terugkomen moeten ze opnieuw beginnen (wizard is client-state, niet persistent).

4. **Na wizard:** gebruiker lands op `/`. Als er geen Hevy en geen Apple Health data is, ziet de gebruiker de home als nullen (zie bevinding 3 bij de home-route). Geen welkomst-scherm, geen "je eerste sync starten" prompt, geen aha-moment.

### Pain points in volgorde van ernst:

- **Kritiek:** Na onboarding geen data → lege homepage (geen empty state). De gebruiker ziet direct dat de app "kapot" lijkt.
- **Hoog:** Stap 3 (Koppelingen) vereist het verlaten van de onboarding-flow. API-sleutels zijn niet makkelijk te vinden voor niet-technische gebruikers.
- **Middel:** Wizard staat als modal op de `/` route. Als de gebruiker de modal sluit ("Overslaan"), komt de lege homepage te voorschijn. Geen zachte onboarding daarna.
- **Laag:** "Overslaan"-knop linkt direct naar `/` zonder te herinneren dat koppelingen later kunnen via Instellingen. Eén zin zou helpen: "Je kunt koppelingen altijd later toevoegen via Instellingen."

### Vergelijking Hevy/Strong/Whoop:
- **Hevy:** onboarding bevraagt doel (kracht/hypertrofie/gewichtsverlies) + voorgestelde templates, toont direct een gegenereerde workoutroutine. Geen API-keys.
- **Strong:** skip-friendly, template-bibliotheek als eerste scherm, waarde direct zichtbaar.
- **Whoop:** hardware-koppeling vereist, maar daarna direct rijke data. Onboarding eindigt met een "eerste recovery score" als aha-moment.

Pulse mist het aha-moment volledig. Het aha-moment van Pulse is: "Ik open de app en zie in één oogopslag of ik vandaag moet trainen en hoe ik ervoor sta." Dat scherm bestaat (Home), maar is onbereikbaar zonder data.

---

## Vergelijking informatie-architectuur

| Criterium | Pulse | Hevy | Strong | Whoop |
|---|---|---|---|---|
| Bottom nav items | 4 (Home, Schema, Progressie, Coach) | 5 (Feed, Workout, Analytics, History, Profile) | 4 (Workout, History, Analytics, Profile) | 5 (tabs contextual) |
| Today's workout prominent op home | Ja | Nee (feed-first) | Ja | Nee (recovery-first) |
| Coach/AI op main nav | Ja | Nee | Nee | Ja (via chat) |
| Workload/belasting bereikbaar | Via link op home | Niet van toepassing | Niet van toepassing | Primaire metric |
| Nutrition op main nav | Via navigatie (5e item?) | Nee | Nee | Ja |

**Bevinding:** Pulse heeft geen Voeding in de bottom nav. `Navigation.tsx:23–28` definieert 4 items: Home, Schema, Progressie, Coach. Voeding en Belasting zijn sub-pagina's bereikbaar via diep linkage. Voor een gebruiker die dagelijks voeding logt (primaire use case) is dit een serieuze navigatie-barrière. Voeding verdient een plek in de bottom nav, of er moet een duidelijk persistent entry-point zijn op de homepage.

---

## Direct uitvoerbare acties (prioriteit volgorde)

1. **Token-migratie starten** — voeg de v2 kleur-tokens toe aan `globals.css` als CSS custom properties naast de bestaande v1-tokens, zodat beide parallel actief zijn tijdens de migratie. Begin met sport-accenten: `--color-sport-gym: #00E5C7`, `--color-sport-run: #FF5E3A`, `--color-sport-padel: #FFB020`, `--color-brand-claude: #D97757`. Rijd dit door WeekAtAGlance en ReadinessSignal als eerste.

2. **Home empty state implementeren** — voeg een `<HomeEmptyState />` component toe dat rendert wanneer `!schemaWeek && !hasHealthData`. Toont drie acties: Hevy koppelen, Apple Health koppelen, Schema aanmaken via Coach. Blokkeer de cascade van null-renders voor nieuwe gebruikers.

3. **ReadinessSignal skeleton** — vervang de `return null` op `DashboardPage.tsx:110` door een eigen skeleton in `ReadinessSignal` (`if (isLoading) return <SkeletonCard className="h-[72px]" />`). Voorkomt layout shift op het meest prominente homepage-element.

4. **Bottom padding deduplicatie** — verwijder `pb-24` van `schema/page.tsx:5`, `ProgressPage.tsx:47`, `GoalsPage.tsx:42`, `NutritionPage.tsx:75`, en `WorkloadPage.tsx:104`. De `pb-[83px]` op de layout-main is voldoende.

5. **themeColor corrigeren** — wijzig `layout.tsx:26` van `themeColor: '#F2F2F7'` naar `themeColor: '#15171F'`. Één-regel fix met directe impact op de iOS-statusbalk in de geïnstalleerde PWA.

---

## Open vragen voor Stef

1. **Navigatie-architectuur:** Voeding zit niet in de bottom nav. Wil je een 5e item toevoegen (dan wordt de nav een beetje vol op kleine schermen), of is er een andere entry point die je prefereert (bijv. een card op de homepage)?

2. **Onboarding-strategie:** De stap "Hevy API key invoeren" is een technische barrière. Overweeg je een "later" pad waar de gebruiker Pulse kan verkennen met testdata (een demo-modus), voordat ze hun API-key invoeren?

3. **Token-migratie pace:** V2-tokens zijn nog niet geïmplementeerd. Wil je een harde cutover (één PR die alle 316 v1-token-verwijzingen omzet naar v2), of een geleidelijke migratie per component/route?

4. **Belasting in navigatie:** `/belasting` is een van de meest informatieve schermen maar is diep verborgen (één link in ReadinessSignal). Wil je dit toegankelijker maken — bijv. als sub-tab onder Progressie, of een persistent kaart op de homepage?

5. **CoachOrb:** De handoff-spec benoemt `CoachOrb` als een component dat overal gebruikt moet worden waar AI betrokken is. Is dit een harde v2-eis voor de komende sprint, of mag het parallel met andere verbeteringen worden opgepakt?
