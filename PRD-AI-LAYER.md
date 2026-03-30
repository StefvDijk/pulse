# PRD: Pulse AI Layer — Van PT-project naar Pulse
**Versie:** 1.0
**Datum:** 30 maart 2026
**Doel:** Pulse op elk punt laten winnen van het huidige Claude PT-project

---

## 1. Huidige Situatie

Pulse heeft een werkende data-pipeline (Hevy sync, Apple Health ingest, aggregatie-engine) maar mist de AI-laag die het PT-project waardevol maakt. Dit document beschrijft alles wat nodig is om Pulse op **elk punt** te laten winnen.

### Scoreboard: PT vs Pulse (huidige stand)

| Functie | PT wint | Pulse wint | Gelijk |
|---|---|---|---|
| Data verzamelen | | ✅ | |
| Wekelijkse check-in & analyse | ✅ | | |
| Schema's genereren/aanpassen | ✅ | | |
| Voedingsanalyse | ✅ | | |
| Blessurecontext & management | ✅ | | |
| Accountability & motivatie | ✅ | | |
| Progressie visualisatie | | | ✅ |
| Historisch overzicht | ✅ | | |

**Doel:** Alle rijen naar "Pulse wint".

---

## 2. Wat er gebouwd moet worden

### 2.1 Anthropic SDK installeren

**Status:** Ontbreekt volledig. Geen dependency in package.json.

```bash
pnpm add @anthropic-ai/sdk
```

Zonder dit werkt geen enkele AI-feature.

---

### 2.2 Chat Agent (het hart van alles)

De chat agent is het kritieke pad. Alles loopt via de chat: voedingsanalyse, blessure-meldingen, schema-requests, wekelijkse reviews, progressie-vragen. De agent moet minstens zo goed zijn als het PT-project, en beter door directe database-toegang.

#### 2.2.1 System Prompt

De system prompt moet ALLES bevatten wat nu in het PT-project als context dient. Dit is geen generieke fitness-bot — dit is Stef's personal trainer die hem door en door kent.

**Vereiste secties in de system prompt:**

```
1. ROL & TOON
   - Je bent Pulse Coach, Stef's personal trainer en voedingscoach
   - Nederlands
   - Zakelijk maar warm. Geen oppervlakkige "goed bezig!" — alleen als het echt zo is
   - Direct en eerlijk. Push door wanneer nodig
   - Evidence-based, geen bro-science
   - Vier echte successen, benoem echte problemen

2. STEF'S PROFIEL
   - 32 jaar, 1.82m, Amsterdam
   - Business analyst bij Hienfeld
   - Grotendeels vegetarisch
   - Traint bij Train More, Piet Heinkade, 06:30
   - Hybrid schema: kantoor di-do, thuis ma/vr
   - Fietst ~14km retour op kantoordagen

3. BLESSURES (KRITIEK — altijd meewegen)
   Rechter schouder:
   - Verdenking intra-articulaire/labrumpathologie
   - Beperkte externe rotatie
   - Pijn bij trekbewegingen en forceful overhead/reikbewegingen
   - Single arm cable row provoceert → chest-supported DB row als alternatief
   - Face pulls en push-ups: pijnvrij
   - MRI-arthrogram referral pending via huisarts
   - GEEN overhead pressing. Geen OHP, geen DB shoulder press

   Knieën:
   - OCD beide knieën, kraakbeentransplantatie (2016)
   - Squats tot parallel, niet diep
   - BSS niet na intervaltraining (minstens 1 dag ertussen)
   - Leg press: beperkt bereik

   Onderrug:
   - Gerelateerd aan langdurig zitten en heupflexor-stijfheid
   - Dead bugs, Pallof press, planks in schema houden
   - RDL's met neutrale rug, initiatie vanuit heupen

4. HUIDIG PROGRAMMA
   - Week 5-8: 4x/week upper/lower split (Upper A, Lower A, Upper B, Lower B)
   - Ma-do gym, vrijdag hardlopen
   - Padel structureel op maandagavond
   - Runna plan (week 7 van 8), race 11 april
   - Vakantie 13-19 april: bodyweight circuit + 2 easy runs

5. VOEDING
   - Target: ~140g eiwit/dag, ~2.100 kcal op trainingsdagen
   - Ontbijt: Upfront Eiwit Oats + whey + creatine
   - Lunch: 400g kwark + toppings
   - Snack: kwark/skyr/eiwitreep rotatie
   - Avondeten: eiwitrijk vegetarisch
   - Supplementen: creatine (dagelijks), electrolytes na runs/padel
   - Weekenden zijn het zwakke punt (alcohol, minder structuur)

6. MOTIVATIEPATROON (CRUCIAAL)
   Stef begint enthousiast maar haakt na een paar weken af.
   Oorzaken: wisselende planning + moeite → training skippen → motivatie zakt.
   Aanpak:
   - Maak progressie zichtbaar met echte cijfers
   - Korte termijn wins elke 1-2 weken
   - Flexibiliteit: help aanpassen, niet "je hebt gefaald"
   - Ochtendtraining beschermen (na werk lukt niet)
   - 30 min gym > thuisblijven
   - Bij twijfel: push door

7. CAPABILITIES
   Je hebt directe toegang tot Stef's trainingsdata via de database.
   - Workouts (Hevy): oefeningen, sets, reps, gewichten, progressie
   - Runs (Apple Health/Runna): afstand, pace, hartslag
   - Padel sessies: duur, hartslag, intensiteit
   - Dagelijkse activiteit: stappen, calorieën, hartslag
   - Voedingslogs: wat hij heeft gegeten + geschatte macro's
   - Blessure-historie
   - Aggregaties: dagelijks, wekelijks, maandelijks
   - Doelen en personal records

   Wanneer je data nodig hebt, gebruik je de beschikbare tools/functies.
   Refereer altijd aan echte cijfers, niet aan algemeenheden.

8. GEDRAGSREGELS
   - Bij voedingsinput: schat macro's, geef kort oordeel, sla op
   - Bij blessure-melding: check recente workouts, analyseer, geef aanbevelingen
   - Bij schema-request: varieer t.o.v. vorige schema's, gebruik progressie-data
   - Bij wekelijkse review: vergelijk met vorige weken, spot trends, geef concrete feedback
   - Bij pijn in knieën/schouder: direct aanpassen, niet doorduwen
   - Geef altijd geschatte macro's bij voedingsvragen (kcal, eiwit, kh, vet)
   - Communiceer in het Nederlands
   - Gebruik Hevy-data voor echte gewichten en progressie, niet geschatte waarden

9. PROGRESSIE-TRACKING
   Barometer-oefeningen (altijd tracken):
   - Push-ups (set 1 max): baseline 8 → week 4: 20
   - Plank (set 1 max): baseline 1:00 → week 4: 1:35
   - Pull-up pogingen (elke 2 weken testen): baseline 0
   - DB Bench Press: baseline 10kg → week 4: 16kg
   - Goblet Squat: baseline 10kg → week 4: 16kg
   - Lat Pulldown: baseline 25kg → week 4: 40kg

10. GELEERDE LESSEN
    - BSS niet na intervals (kniestress)
    - Eten min 2 uur voor een run (maagklachten)
    - Creatine dagelijks, niet alleen op trainingsdagen
    - Electrolytes na runs en padel, niet na gym
    - Verzadigingsformule: volume + eiwit + vezels
    - Eiwitarme snacks lossen middaghonger niet op
```

#### 2.2.2 Context Assembler

De context assembler bepaalt welke data Claude meekrijgt per vraagtype. Dit is cruciaal voor kwaliteit en token-efficiency.

**Vraagtype detectie** (keyword-based, geen extra Claude call):

| Vraagtype | Trigger keywords | Data om mee te sturen |
|---|---|---|
| `nutrition_log` | "gegeten", "at", "ontbijt", "lunch", "diner", "snack", voedsel-keywords | Voedingslogs vandaag, activiteit vandaag, profiel |
| `nutrition_question` | "honger", "wat eten", "hoeveel eiwit", "macro" | Voedingslogs vandaag, targets, activiteit |
| `injury_report` | "pijn", "last van", "blessure", lichaamsdeel-keywords | Workouts 14 dagen, spiergroep verdeling 4 weken, eerdere blessures, huidig schema |
| `schema_request` | "nieuw schema", "trainingsschema", "wat moet ik trainen" | Huidige + vorige 3 schema's, progressie 3 maanden, doelen, blessures |
| `progress_question` | "hoe gaat het", "vooruitgang", "progressie", "hoeveel" | Relevante aggregaties, PRs, doelen |
| `weekly_review` | "weekoverzicht", "week", "evaluatie", "check-in", "zondag" | Weekly agg, vergelijking 4-weeks gemiddelde, adherence, voeding gemiddelden, blessures |
| `general_chat` | alles anders | Profiel, actieve doelen, huidig schema (light context) |

**Data compressie per type:**

| Data | Recent (<7 dagen) | 7-14 dagen | >14 dagen |
|---|---|---|---|
| Workouts | Volledig (oefening, sets, reps, gewicht) | Samengevat (titel, #sets, focus) | Alleen via aggregaties |
| Runs | Volledig | Samengevat | Via aggregaties |
| Voeding | Volledig (vandaag) | Gemiddelden | Via aggregaties |
| Blessures | Alle actieve, volledig | Alle actieve | Alle |
| Schema's | Huidig: volledig | Vorige: samenvatting | Vorige: alleen block summary |

**Token budget:** Max ~8000 tokens data-context per request.

#### 2.2.3 Streaming Chat API

```
POST /api/chat
Body: { message: string, session_id?: string }
Response: text/event-stream (Server-Sent Events)

Flow:
1. Auth check (Supabase session)
2. Classificeer vraagtype
3. Assembleer context (database queries)
4. Bouw prompt: system prompt + context + chat history + user message
5. Stream Claude response (claude-sonnet-4-20250514)
6. Sla user message + assistant response op in chat_messages
7. Write-back: als response voeding/blessure/schema bevat → opslaan

Write-back triggers:
- Voedingsanalyse gedetecteerd → parse macro's → nutrition_logs + daily_nutrition_summary
- Blessure gemeld → injury_logs
- Schema bevestigd → training_schemas (vorige deactiveren)
```

#### 2.2.4 Chat UI

Moet werken op twee plekken:
1. **Full page** (`/chat`): volledige chat interface
2. **Floating mini-chat**: beschikbaar op alle pagina's

**Vereisten:**
- Streaming text effect (token voor token)
- Markdown rendering in berichten
- Auto-scroll naar nieuwste bericht
- Suggesties bij start (context-afhankelijk)
- Chat sessie management
- Enter = verstuur, Shift+Enter = newline

**Suggesties (context-afhankelijk):**
- Op zondag: "Hoe was mijn week?", "Check mijn progressie"
- Na een workout (Hevy sync): "Analyseer mijn workout van vandaag"
- Op trainingsdag: "Wat train ik vandaag?"
- Altijd: "Log wat ik heb gegeten", "Hoe sta ik met mijn doelen?"

---

### 2.3 Voedingsanalyse

**Waarom Pulse moet winnen:** In het PT-project typt Stef wat hij eet, krijgt macro-schatting + oordeel. Pulse moet dit beter doen door het ook op te slaan, te tellen, en de dag-totalen bij te houden.

#### 2.3.1 Voedings-prompt

```
Je bent een voedingsanalyst. De gebruiker beschrijft wat hij heeft gegeten.

Stef is grotendeels vegetarisch. Hij eet vis ~1x/week, vlees alleen buiten de deur.
Zijn dagelijkse eiwitdoel is 140g, calorie-target ~2.100 kcal op trainingsdagen.

Analyseer de input en geef terug als JSON:
{
  "meal_description": "korte beschrijving",
  "meal_type": "breakfast|lunch|dinner|snack",
  "estimated_calories": number,
  "estimated_protein_g": number,
  "estimated_carbs_g": number,
  "estimated_fat_g": number,
  "estimated_fiber_g": number,
  "confidence": "low|medium|high",
  "notes": "kort oordeel of tip (1-2 zinnen, Nederlands)"
}

Wees realistisch met portiegroottes (Nederlands/Europees).
Bij twijfel over portie: vraag niet, schat conservatief.
Geef altijd een kort oordeel: past dit bij zijn doelen?
```

#### 2.3.2 Voedings-flow

```
1. User typt: "Havermout met banaan en honing"
2. POST /api/nutrition/analyze → Claude JSON response
3. Opslaan in nutrition_logs
4. Herbereken daily_nutrition_summary
5. Toon resultaat als kaart: maaltijd + macro's + oordeel
6. Update protein tracker + macro donut op voedingspagina
```

#### 2.3.3 Voedingspagina componenten

- **NutritionInput**: tekstveld bovenaan, submit → loading → resultaat-kaart
- **MacroSummary**: donut chart (eiwit/kh/vet) met Recharts PieChart, targets als referentie
- **ProteinTracker**: horizontale balk, kleurcode (rood <70%, geel 70-90%, groen ≥90%)
- **DayIndicator**: "Je zit goed vandaag" / "Je mist nog ~40g eiwit"
- **MaaltijdenLijst**: chronologisch, per entry: tijd, input, macro's, verwijder-knop

---

### 2.4 Wekelijkse Check-in (zondag)

**Waarom Pulse moet winnen:** Nu stuurt Stef screenshots op zondag. Pulse heeft de data al — het moet de analyse zelf kunnen doen, beter en sneller dan het PT-project.

#### 2.4.1 Automatische week-samenvatting

Wanneer Stef op zondag de chat opent of "hoe was mijn week" typt, moet de agent:

1. **Wekelijkse aggregatie ophalen** (deze week vs vorige weken)
2. **Per sport vergelijken:**
   - Gym: sessies, tonnage, progressie per oefening (vergelijk gewicht/reps met vorige week)
   - Hardlopen: km, pace, vergelijk met vorige weken
   - Padel: sessies, duur, intensiteit
3. **Adherence checken:** geplande vs voltooide sessies
4. **Voeding gemiddelden:** eiwit/dag, calorieën/dag vs targets
5. **Trends spotten:** wat gaat omhoog, wat stagneert, wat gaat achteruit
6. **Concrete aanbevelingen:** max 3, actionable
7. **Planning komende week** voorstellen

**Output formaat:**
```
📊 Week [nummer] — [datum range]

TRAINING
- Gym: [X]x (doel: 4x) — [tonnage]kg totaal ([trend])
- Hardlopen: [X] km over [Y] sessies — gem. pace [Z]/km
- Padel: [X]x

PROGRESSIE
- [Oefening]: [vorige week] → [deze week] [↑/↓/=]
- [Oefening]: [vorige week] → [deze week] [↑/↓/=]

VOEDING
- Gem. eiwit: [X]g/dag (doel: 140g) — [oordeel]
- Gem. kcal: [X]/dag

AANDACHTSPUNTEN
1. [Concreet punt]
2. [Concreet punt]

KOMENDE WEEK
[Schema/planning suggestie]
```

---

### 2.5 Schema Generatie & Aanpassing

**Waarom Pulse moet winnen:** In het PT-project itereren we: "meer focus op pull", "BSS niet na intervals", "schouder doet pijn bij die oefening". Pulse moet dit kunnen met directe toegang tot progressie-data.

#### 2.5.1 Schema-generatie prompt

De prompt moet instrueren:
1. Varieer t.o.v. vorige schema's (exercises_used uit schema_block_summaries)
2. Gebruik progressie-data voor realistische startgewichten
3. Respecteer alle blessure-beperkingen
4. Houd sessies onder 55 minuten
5. Output als gestructureerd JSON (compatible met training_schemas.workout_schedule)

#### 2.5.2 Iteratieve aanpassing

```
User: "Ik wil een nieuw schema"
Agent: [genereert schema, toont als leesbare tabel]
User: "Meer focus op pull, en ik wil hip thrust erin"
Agent: [past aan, toont update]
User: "Ziet er goed uit"
Agent: [slaat op in training_schemas, deactiveert vorige, maakt block summary]
```

---

### 2.6 Blessure Management

**Waarom Pulse moet winnen:** Het PT-project kent Stef's blessuregeschiedenis alleen uit context. Pulse heeft een injury_logs tabel en kan automatisch correleren met workouts.

#### 2.6.1 Blessure-detectie in chat

Wanneer de user woorden gebruikt als "pijn", "last", "blessure", lichaamsdeel:
1. Classificeer als `injury_report`
2. Haal op: workouts afgelopen 14 dagen, spiergroep verdeling, eerdere blessures zelfde locatie
3. Analyseer: mogelijke oorzaak, correlatie met recent volume
4. Sla op in `injury_logs`
5. Pas schema-aanbevelingen aan

#### 2.6.2 Proactieve blessure-waarschuwingen

Bij wekelijkse check-in:
- Check of spiergroep-balans scheef is (push >> pull)
- Check of volume plotseling is gestegen (ACWR > 1.3)
- Check of er herhaalde blessure-meldingen zijn voor dezelfde locatie

---

### 2.7 Progressie Dashboard (visueel)

**Waarom Pulse moet winnen:** Het PT-project gebruikt handmatige markdown tabellen. Pulse moet interactieve charts tonen met echte data.

#### 2.7.1 Vereiste dependencies

```bash
pnpm add recharts swr
```

#### 2.7.2 Dashboard componenten (koppelen aan echte data)

Alle dashboard componenten staan als "done" in de backlog maar draaien op test data. Ze moeten gekoppeld worden aan echte Supabase queries via SWR hooks.

**Data hooks nodig:**

```typescript
// src/hooks/useDashboardData.ts
// Haalt op: weekly_aggregations (huidige week), daily_aggregations (7 dagen), 
// actief schema, workouts deze week

// src/hooks/useProgressData.ts  
// Haalt op: weekly_aggregations (range), PRs, doelen, run data
// Tijdsperiode parameter (4w, 3m, 6m, 1y)

// src/hooks/useNutritionData.ts
// Haalt op: nutrition_logs (vandaag), daily_nutrition_summary, targets
```

#### 2.7.3 Specifieke charts

1. **Workload Meter**: SVG gauge met ACWR ratio uit weekly_aggregations
2. **Spiergroep Heatmap**: SVG body outline, kleuring op basis van muscle_load uit daily_aggregations
3. **Sport Split**: horizontale bars (gym/running/padel) met sessie counts
4. **Adherence Tracker**: 7 cirkels (ma-zo), geplande vs voltooide sessies
5. **Strength Chart**: Recharts LineChart, e1RM per bewegingspatroon over tijd
6. **Running Chart**: bars (wekelijks km) + lijn (gem. pace)
7. **Volume Trend**: stacked bar (tonnage/km/padel-uren per week)

---

### 2.8 Historisch Overzicht

**Waarom Pulse moet winnen:** Het PT-project heeft alleen de huidige conversatie. Pulse heeft maanden data in de database.

#### 2.8.1 Trends pagina

- **Maand vergelijking**: huidige vs vorige maand, delta's met pijlen
- **Kwartaal vergelijking**: idem over 3 maanden
- **"Een jaar geleden"**: snapshot van dezelfde week vorig jaar (placeholder als niet genoeg data)

#### 2.8.2 Personal Records

- Lijst gesorteerd op datum (nieuwste eerst)
- Per PR: oefening, waarde, datum, delta vs vorig record
- Automatisch gedetecteerd bij nieuwe workout data (vergelijk met personal_records tabel)

---

### 2.9 Kennismigratie: PT-project → Pulse

Alle kennis die nu in het PT-project leeft moet naar Pulse. Dit gaat via twee routes:

#### 2.9.1 System prompt (statische kennis)

Alles uit sectie 2.2.1 hierboven. Dit is de "persoonlijkheid" en domeinkennis van de agent.

#### 2.9.2 Database seeding (historische data)

Stef's bestaande progressie-data moet in de database:

1. **InBody metingen** → profiles (weight_kg updates) + goals (body composition)
2. **Baseline metingen** (23 feb) → personal_records
3. **Huidige schema** (week 5-8 upper/lower) → training_schemas
4. **Block summary week 1-4** → schema_block_summaries
5. **Blessure-info** → injury_logs (schouder, knieën, onderrug)
6. **Bestaande doelen** → goals (pull-up, DB bench 20kg, etc.)

Dit kan via een eenmalig seed script of handmatig via de chat agent.

---

## 3. Technische Architectuur

### 3.1 Nieuwe dependencies

```json
{
  "@anthropic-ai/sdk": "latest",
  "recharts": "^2.x",
  "swr": "^2.x",
  "react-markdown": "^9.x",
  "remark-gfm": "^4.x"
}
```

### 3.2 Nieuwe bestanden

```
src/
├── lib/
│   └── ai/
│       ├── client.ts                  # Anthropic SDK client
│       ├── context-assembler.ts       # Data queries per vraagtype
│       ├── classifier.ts             # Vraagtype classificatie
│       └── prompts/
│           ├── chat-system.ts         # System prompt (alles uit 2.2.1)
│           ├── nutrition-analysis.ts  # Voedingsanalyse prompt
│           ├── schema-generation.ts   # Schema generatie prompt
│           └── weekly-summary.ts      # Week samenvatting prompt
├── app/
│   └── api/
│       ├── chat/route.ts             # Streaming chat endpoint
│       └── nutrition/
│           └── analyze/route.ts      # Voedingsanalyse endpoint
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx         # Full page chat
│   │   ├── ChatMessage.tsx           # Enkel bericht (markdown)
│   │   ├── ChatInput.tsx             # Input + submit
│   │   └── ChatSuggestions.tsx       # Context-afhankelijke suggesties
│   ├── nutrition/
│   │   ├── NutritionInput.tsx
│   │   ├── MacroSummary.tsx
│   │   ├── ProteinTracker.tsx
│   │   └── DayIndicator.tsx
│   ├── dashboard/
│   │   ├── WorkloadMeter.tsx         # ACWR gauge
│   │   ├── SportSplit.tsx            # Sport uren
│   │   ├── AdherenceTracker.tsx      # Ma-Zo cirkels
│   │   └── WeekSummaryCard.tsx       # Compacte week stats
│   └── layout/
│       └── MiniChat.tsx              # Floating chat button
└── hooks/
    ├── useDashboardData.ts
    ├── useProgressData.ts
    ├── useNutritionData.ts
    ├── useChat.ts
    └── useProfile.ts
```

### 3.3 API Endpoints

| Endpoint | Method | Doel |
|---|---|---|
| `/api/chat` | POST | Streaming chat (SSE) |
| `/api/nutrition/analyze` | POST | Voedingsanalyse → JSON |
| `/api/chat/sessions` | GET | Lijst van chat sessies |
| `/api/chat/sessions/[id]` | GET | Berichten van een sessie |

---

## 4. Prioritering

### Fase 1: Chat agent werkend (de kern)
1. Anthropic SDK installeren
2. AI client (`src/lib/ai/client.ts`)
3. System prompt schrijven (`src/lib/ai/prompts/chat-system.ts`)
4. Context assembler (`src/lib/ai/context-assembler.ts`)
5. Vraagtype classifier (`src/lib/ai/classifier.ts`)
6. Chat API route met streaming (`/api/chat`)
7. Chat UI componenten (ChatInterface, ChatMessage, ChatInput)
8. Chat pagina assembleren (`/chat`)

**Na fase 1:** Pulse kan alles wat het PT-project kan qua conversatie, maar dan met directe database-toegang.

### Fase 2: Voeding werkend
9. Voedingsanalyse prompt
10. Voedingsanalyse API route
11. NutritionInput component
12. MacroSummary + ProteinTracker
13. Voedingspagina assembleren

**Na fase 2:** Voedingstracking werkt beter dan in het PT-project (opslaan + dag-totalen).

### Fase 3: Dashboard met echte data
14. SWR + Recharts installeren
15. Data hooks (useDashboardData, useProgressData)
16. Dashboard componenten koppelen aan echte data
17. Progressie charts bouwen

**Na fase 3:** Visueel overzicht dat het PT-project nooit kon bieden.

### Fase 4: Schema generatie + blessure management
18. Schema generatie prompt
19. Iteratieve schema-aanpassing via chat
20. Blessure-detectie en -opslag via chat
21. Proactieve waarschuwingen bij check-in

**Na fase 4:** Pulse wint op elk punt.

### Fase 5: Kennismigratie
22. Seed script voor bestaande data (baseline metingen, schema's, blessures, doelen)
23. Floating mini-chat op alle pagina's

---

## 5. Acceptatiecriteria: "Pulse wint"

| Functie | Pulse wint wanneer... |
|---|---|
| Data verzamelen | ✅ Al gewonnen (Hevy sync, Apple Health ingest) |
| Wekelijkse check-in | Agent genereert automatische week-analyse met echte data, vergelijkt met vorige weken, geeft concrete aanbevelingen |
| Schema's | Agent genereert schema's met echte progressie-data en blessure-context, iteratief aanpasbaar via chat |
| Voedingsanalyse | Natural language input → macro-schatting → opgeslagen → dag-totalen zichtbaar met charts |
| Blessurecontext | Agent kent alle blessures uit database, correleert met workouts, waarschuwt proactief |
| Accountability | Agent kent Stef's motivatiepatroon, pusht wanneer nodig, maakt progressie zichtbaar met echte cijfers |
| Progressie visualisatie | Interactieve charts met echte data (strength, running, volume over tijd) |
| Historisch overzicht | Maand/kwartaal vergelijkingen, "een jaar geleden", personal records — allemaal uit database |

---

## 6. Wat Pulse NIET hoeft te doen

- Geen notificaties of push alerts (pull, niet push)
- Geen social features
- Geen Garmin/Fitbit integratie
- Geen light mode (dark only)
- Geen multi-language (alleen Nederlands)
- Geen perfecte calorie-tracking (schattingen zijn prima)
