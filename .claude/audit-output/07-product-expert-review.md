# 07 — Product Expert Review: Pulse

## 1. Executive Summary (brutaal eerlijk)

Pulse is een technisch indrukwekkende single-user data-aggregator met een echte USP (AI coach met cross-discipline context), maar als commercieel product op de huidige markt is het positioneringloos. Hevy kost $24/jaar en pakt 80% van wat power-users willen in een native iOS/Android app met Apple Watch support. Whoop verkoopt premium "recovery" voor $200/jaar met hardware moat. Pulse zit ertussenin: te complex voor beginners, te incompleet (geen native app, geen wearable, Apple-only ingest) voor de Strava/Whoop-tier prosumer. De enige levensvatbare commerciële richting is een betaalde niche: "AI cross-sport coach voor multi-discipline hobby-atleten die al Hevy + Strava/Runna + Apple Health gebruiken." Dat is een markt van duizenden, niet miljoenen. Voor Stef persoonlijk: blijf bouwen, lever 'm op aan vrienden. Voor een SaaS-launch: schrap 40% van de features, bouw een Expo wrapper + watchOS shortcut, en focus 100% op de coach-loop.

## 2. SWOT

| | Positief | Negatief |
|---|---|---|
| **Intern** | **Strengths:** alle data in 1 db; AI coach met écht cross-context (gym+run+slaap+voeding+padel); ACWR wetenschappelijk fundament; eigenaarschap data (GDPR/EU); schema-engine + write-back tool calls; weekly check-in met Calendar write is uniek workflow-niveau | **Weaknesses:** geen native mobile (Next.js web — push noti's & background sync zwak); geen Apple Watch / wearable app; HAE-afhankelijkheid = iOS-only & $3/mo extra friction; Hevy Pro dependency ($5/mo) verplicht voor users; geen voice-logging; geen offline; geen onboarding flow; single-user testdata = onbekende eval kwaliteit AI |
| **Extern** | **Opportunities:** cross-discipline coach is écht een gat in de markt (Whoop kent geen sets, Hevy kent geen slaap, Strava kent geen kracht); EU-hosting kan B2C differentiator zijn; Claude tool-use maakt agentic coaching realistisch; €9.99/mo prosumer-niche is bewezen (Future $200/mo, Caliber $150/mo, Fitbod $16/mo) | **Threats:** Hevy heeft de data al en kan dit zelf bouwen (zien al "Hevy Trainer" auto-progression); Whoop $200M+ funded en heeft AI coach gelanceerd; Apple Fitness+ wordt steeds slimmer en is gratis bij Apple One; Strava Premium voegt jaarlijks features toe; OpenAI/Anthropic kunnen "personal coach" als platformfeature releasen |

## 3. Concurrentenmatrix

| Feature | Pulse | Hevy ($24/jr) | Strong ($30/jr) | Strava Prem (~$80/jr) | Whoop ($200+/jr) | Fitbod ($96/jr) | Future ($200/mo) |
|---|---|---|---|---|---|---|---|
| Gym set logging | via Hevy (geen eigen) | ✅ native | ✅ native | ❌ | ❌ | ✅ | ✅ (via coach) |
| Run tracking | via Apple Health | beperkt | ❌ | ✅ best-in-class | basic | ❌ | ❌ |
| Sleep/HRV/Recovery | ✅ (via HAE) | ❌ | ❌ | ❌ | ✅ best-in-class | ❌ | ❌ |
| Cross-sport load (ACWR) | ✅ **uniek** | ❌ | ❌ | beperkt (Fitness/Freshness) | ✅ Strain | ❌ | menselijk |
| AI coach met chat | ✅ **uniek** | ❌ (Hevy Trainer = progression only) | ❌ | ❌ | ✅ Whoop Coach | beperkt | menselijk |
| AI met cross-context | ✅ **uniek (gym+run+slaap+voeding)** | ❌ | ❌ | ❌ | recovery-only | gym-only | ja, menselijk |
| Apple Watch app | ❌ | ✅ | ✅ | ✅ | ✅ hardware | ✅ | n.v.t. |
| Native iOS/Android | ❌ (web) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voice logging | ❌ | ❌ | ❌ | n.v.t. | n.v.t. | ❌ | n.v.t. |
| Push notifications | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Social / friends | ❌ | ✅ feed | ❌ | ✅ **moat** | beperkt | ❌ | 1-on-1 |
| Streaks / habits | ❌ | beperkt | beperkt | ✅ | ❌ | ✅ | n.v.t. |
| Nutrition tracking | ✅ NL-input | ❌ | ❌ | ❌ | beperkt | ❌ | ❌ |
| Schema generator | ✅ AI | beperkt (routines) | manual | ❌ | ❌ | ✅ **moat** | menselijk |
| Form check / video | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | menselijk |
| Garmin/Polar/Whoop sync | ❌ | ❌ | ❌ | ✅ | n.v.t. | ❌ | ❌ |
| Calendar integratie | ✅ Google | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Body composition | ✅ | ❌ | ❌ | ❌ | beperkt | ❌ | ❌ |
| Pricing model | TBD | $24/jr | $30/jr or $100 LTD | $80/jr | $200-359/jr | $96/jr | $200/mo |
| Moat | data-fusion + AI context | network effect + free tier | brand loyalty | social graph | hardware + science | algoritme | menselijke trainer |

**Conclusie:** Pulse heeft 3 unieke kolommen (cross-context AI, ACWR, Calendar-write check-in). De rest is achterstand. Een markt-app moet alle ✅'s van Hevy hebben *plus* de Pulse-unieke kolommen — anders verlies je op tafel-stakes.

## 4. Feature-prioriteit matrix (impact × effort)

| Feature | Impact | Effort | Score (1-10) | Reden |
|---|---|---|---|---|
| **Push notifications + coaching nudges** | Very High | Low | **10** | Retentie #1 driver in fitness apps. Pulse heeft AI context — een gerichte "je RHR is +6, sla zware deadlift over" om 06:30 is goud waard. Zonder dit is Pulse passief en wordt 1x/week geopend. |
| **Habit streaks + weekly adherence visualisatie** | High | Low | **9** | Goedkoopste retentie mechaniek die bestaat. Stef heeft adherence-data, maar visualiseert 't niet als streak. Duolingo-effect werkt ook in fitness. |
| **Native wrapper (Expo/Capacitor) + iOS push** | Very High | Medium | **9** | Web-app is dood voor fitness retentie. Apple App Store presence = 80% van discovery. Hoeft geen full-native rewrite; Capacitor wrap + APNs = 2 weken. |
| **Apple Watch quick-log shortcut (Siri Shortcut)** | High | Low | **9** | Volledige WatchOS app = maanden. Maar een Siri Shortcut "log 100g havermout" of "ik ben ziek" die HTTP POST naar `/api/ingest` doet = 1 dag werk en lost 60% van wearable-need op. |
| **Onboarding (5-stappen wizard)** | Very High | Medium | **9** | Pulse is nu onbruikbaar voor nieuwe users. Eerste 5 min bepaalt of iemand betaalt. Hevy/Strava hebben 90-sec onboarding. |
| **Eén "Today" hero metric** | High | Low | **8** | Home is te druk (readiness + workout + week + activity + nudge + sync). Whoop succes = 1 score (recovery 0-100). Pulse moet 1 hero hebben (readiness 0-100 of "should-I-train"). De rest verstoppen. |
| **AI eval harness (regression tests voor coach)** | Very High | Medium | **9** | Geen evals = geen vertrouwen. Een SaaS met AI coach die zo nu en dan hallucineert verliest users in 1 maand. Critical voor betaal-launch. |
| **Garmin / Whoop / Oura ingest** | High | Medium | **8** | 40% van prosumer-doelgroep gebruikt geen Apple Watch. Garmin Connect API + Whoop API + Oura API zijn alle 3 redelijk toegankelijk. Zonder dit verlies je TAM. |
| **Voice logging tijdens workout** | High | Medium | **7** | "Hey Pulse, bench 80x8" tijdens set is killer feature. Maar Hevy doet 't ook niet — niet tafel-stakes. Cool differentiator, geen prio v1. |
| **Social / friends / kudos** | Medium | High | **5** | Strava's moat. Maar Pulse is single-user mindset; bouwen van een social graph as startup is brutaal hard. Niet doen v1; mss invite-only "training partner" in v2. |
| **Form check via video AI** | Low | Very High | **3** | Demoware. Niemand gebruikt 't langer dan een week (zie Onyx, Tempo). Skip. |
| **PDF export / coach sharing** | Medium | Low | **7** | Quick win voor users met menselijke coach/PT. "Stuur je week-review naar je trainer" = makkelijk virale loop. |
| **Recipe database + meal plan generator** | Low | Very High | **2** | MyFitnessPal/Cronometer/Yazio domineren. Pulse moet NL-nutrition houden zoals 't is en daar stoppen. Niet bouwen. |
| **Family / coach sharing (read-only access)** | Medium | Medium | **6** | Niche maar high-value voor de "PT die 10 klanten in Pulse zet" use case. v2 of Pro-tier. |
| **Offline mode** | Medium | High | **5** | Belangrijk in gym (slechte 4G). Web-app maakt dit moeilijk. Met native wrapper + IndexedDB redelijk haalbaar in v1.5. |
| **Reschedule via natural language ("Schuif morgen naar woensdag")** | Medium | Low | **7** | Pulse heeft `/reschedule` endpoint en chat. Dit is een 1-dags integratie en killer DX. |

## 5. Wat te schrappen of verstoppen

| Feature | Beslissing | Reden |
|---|---|---|
| `/belasting` (ACWR-pagina) | **Verstoppen achter "Advanced" toggle of Pro-tier** | ACWR is zelfs onder professionele S&C-coaches controversieel. 90% van users snapt "acute:chronic 1.4" niet. Bewaar de berekening achter de schermen, toon op home alleen "workload: oplopend / stabiel / dalend" met een kleurband. |
| `/trends` (maand/kwartaal/jaar) | **Schrap of consolideer in `/progress`** | Dubbele bron met `/progress`. Niemand opent een aparte "trends" tab. Voeg toggle "1m/3m/1y" toe in progress. |
| Multiple aggregation cron jobs gescheiden | **Code-houden, niet UI** | Power user value, niet feature. Niet adverteren. |
| Body composition (vet%, viscerale vet, body water) | **Houden, simpeler tonen** | Stef-specifiek (heeft slimme weegschaal). Voor markt: collapsen naar "gewicht + lichaamsvet%". Visceral vet en body water → details/Pro. |
| Muscle heatmap | **Houden — dit is een visuele hook** | Goede onboarding/marketing asset, instant begrip. Zelfs als users niet snappen wat "muscle load 0.8" betekent, ze begrijpen rood = veel. |
| Custom AI instructions in settings | **Verstoppen** | 1% gebruikt 't. Power user setting, niet op de hoofd-settings pagina. |
| AI context preview (`/api/ai-context-preview`) | **Houden voor debug, niet in UI** | Goeie devtool, niemand anders ziet dit ooit. |
| Home: activity feed + week-at-a-glance + daily health bar + nudge + readiness + sync | **Reduceren tot 3 blokken** | Te druk. Pick: (1) Today hero (readiness/coach-orb), (2) Workout-card, (3) Week-strip. De rest naar `/progress` of weg. |
| Hevy routines tab (`hevy_routines` table exposed) | **Schrap uit UI** | Implementation detail. Users hoeven het verschil routine vs schema niet te zien. |
| Padel als first-class sport-categorie in UI | **Houden, want differentiator** | Geen enkele app doet padel. Voor NL/Spanje markt = scherp positioneringsvoordeel. |

## 6. Pricing-voorstel

### Tagline
**"Pulse — De coach die al je sport-data leest. Krachttraining, hardlopen, slaap, voeding. Eén AI die het verbindt."**

(Alternatief, scherper: *"One coach for every sport you do."*)

### Tiers

**Free — €0**
- Hevy + Apple Health ingest (max 1 sport-bron)
- Dashboard (home + progress)
- Workouts list & PR's
- AI coach: **10 chats per maand** (rate limit)
- Geen Calendar integration, geen schema engine, geen check-in

**Pro — €7.99/maand of €69/jaar** (Strava-tier, onder Whoop)
- Alle bronnen (Hevy, alle Apple Health categorieën, Garmin, Oura)
- Onbeperkte AI chats
- Weekly check-in met Google Calendar write
- Schema generator + reschedule
- Nutrition NL-input
- Push notifications
- PDF export naar coach
- 1 sport-discipline ACWR ("workload")

**Performance — €14.99/maand of €129/jaar** (onder Fitbod, ver onder Whoop)
- Alles van Pro
- Multi-discipline ACWR (cross-sport belasting — het wetenschappelijk uniekste stukje)
- AI "weekly review video": 1x/week genereert Claude een 2-min voice-summary van je week
- Coach-shareable view (read-only link voor PT / fysio / partner)
- Voice logging (als gebouwd)
- Whoop ingest
- Priority Claude (sneller, langere context)

**Niet doen:** lifetime deal (Strong/Hevy doen het, prijs anchor verkeerd voor SaaS economics met Claude API kosten).

**Marge-check:** Bij €7.99/mo, Claude API ~€1.50/user/mo (10k tokens × 30 chats), Supabase ~€0.20, Vercel ~€0.10 → ~€6.10 bruto. Solide.

## 7. Go-to-market (8-week launch plan)

### Target persona (eerste 1000 users)
**"De Strava-Hevy-Apple-Watch power user die zijn data graag in spreadsheets gooit."**

Concreet profiel:
- 28-42 jaar oud
- 3-5x/week sporten in 2+ disciplines (typisch kracht + cardio of kracht + sport)
- Heeft betaald: Hevy Pro + Strava Premium + ofwel Whoop ofwel Oura
- Volgt /r/Fitness, /r/AdvancedFitness, /r/Strava, /r/peloton, /r/triathlon
- Lurkt op TrainerRoad / DC Rainmaker forums
- Heeft ooit een spreadsheet gemaakt om Hevy + Strava data te combineren
- Niet competitief op nationaal niveau, wel "ik wil mijn 5k onder 22 min en bench 1.5x bodyweight"

### Distributiekanalen (gerangschikt)

1. **/r/AdvancedFitness, /r/Strava, /r/triathlon** — niet shameless promo, maar "Ik bouwde dit omdat ik gek werd van data switchen tussen Hevy en Strava" build-in-public posts. Verwachting: 100-300 beta-signups per goede post.
2. **DC Rainmaker / FitNerd / The Quantified Scientist YouTube/blogs** — pitch een review unit. Whoop, Garmin doen dit consistent. Pulse review op DC Rainmaker = 5000 visitors in week.
3. **Build-in-public op X / Bluesky / LinkedIn** — Stef post wekelijkse "what Pulse caught this week" met echte cross-sport inzichten (bv "ik trainde benen na slechte slaap, RHR was +8 — Pulse waarschuwde, ik luisterde niet, blessure"). Authentiek, geen marketing-jargon.
4. **Hevy Discord / Strava clubs** — geen direct adverteren (TOS), wel community-meeloop + 1-op-1 invites.
5. **Producthunt launch in week 8** — niet als groei-kanaal (PH is dood-ish), wel als legitimering en SEO-backlink.
6. **Niet doen v0:** Meta/Google ads (€50 CAC voor €70/jr LTV = niet houdbaar). Influencer-sponsoring fitness-bro's (off-brand).

### 8-week plan

| Week | Doel | Output |
|---|---|---|
| 1 | **Onboarding + paywall** | 5-stap wizard (Hevy connect, HAE connect, sport-selectie, doel, persona). Stripe ingebouwd, free/pro/performance tiers live. |
| 2 | **Native wrapper + push** | Expo wrapper rondom Next.js (of Capacitor). iOS APNs voor "coaching nudges". TestFlight build. |
| 3 | **AI eval harness + rate limits** | Regression tests voor coach (50 vragen, gouden antwoorden), rate limiting per tier, kosten-monitoring per user. |
| 4 | **Closed beta (30 mensen)** | Stef's netwerk + 20 mensen uit fitness-Twitter/Reddit DM's. Free Pro voor 3 mnd in ruil voor 1 video-call feedback. |
| 5 | **Schrap-lijst doorvoeren + home redesign** | "Today hero" landing, ACWR achter advanced, trends gemerged in progress. |
| 6 | **Garmin ingest + Siri Shortcut + streaks** | TAM-uitbreiding voor non-Apple-Watch users. Habit-streak UI. |
| 7 | **Content drop** | Stef's eigen 12-weeks case study als longform post. DC Rainmaker outreach. |
| 8 | **Public launch** | Producthunt + Reddit + X-thread. Doel: 200 signups, 30 betalend in week 1. |

**KPI targets na 8 weken:**
- 1000 free signups
- 50-80 betalend (5-8% conversie, in lijn met fitness-app benchmarks — Fitbod claimt 8%, Strong 5%)
- ~€500 MRR
- Churn maand 1: <15% (industry: 20-30% maand-1 voor fitness apps)
- App Store rating: 4.5+ (mits native wrapper presentabel is)

**Brutale honest check:** als na 8 weken minder dan 20 betalend, is positionering fout. Niet meer features bouwen — pivot of stop.

## 8. Direct uitvoerbare acties (top 5)

1. **Bouw onboarding (week 1).** Geen onboarding = geen markt. Stef test 't met 3 vrienden uit z'n netwerk vóór elke andere feature.
2. **Verstop `/belasting` ACWR achter "Advanced" toggle en simplificeer home tot 3 blokken** (today-hero, workout, week-strip). Direct uitvoerbaar in 1-2 dagen.
3. **Implementeer push notifications via Expo + APNs** (of als short-term workaround: SMS/email coaching nudges via een dagelijkse cron). Zonder push is Pulse passief = dood.
4. **Bouw AI eval-harness met 30-50 testvragen** (slaap-vraag, blessure-melding, schema-vraag, voeding) en draai 'm bij elke prompt-wijziging. Anders is een betaalde coach niet verkoopbaar.
5. **Schrijf 1 longform build-in-public post** ("Hoe ik mijn Hevy + Strava + Apple Health in 1 dashboard kreeg en wat ik leerde") en post op /r/AdvancedFitness. Acquisitie-test vóór launch.

## 9. Open vragen voor Stef

1. **Ambitie-check:** Is Pulse een hobby (single-user voor jezelf, blijven leren) of een product (SaaS, 1000+ betalende users)? Het ontwerp/keuzes verschillen drastisch. De ACWR + body comp + custom AI instructions zijn nu hobby-keuzes. SaaS-keuzes zijn onboarding + push + native wrapper.
2. **Welke sport-discipline laat je los voor v1?** Padel is NL/ES-niche maar uniek. Cycling is enorm (Strava-tier). Welke gaat in?
3. **Hevy-dependency: comfortabel mee?** Als Pulse populair wordt is Hevy een single point of failure (zij kunnen API beperken zoals Twitter deed). Plan B: eigen workout-logger of Strong-API ondersteuning?
4. **Apple Watch native app: wel/niet?** Volledige WatchOS app = 3-4 mnd werk en App Store complexiteit. Siri Shortcut = 1 dag en lost 60% op. Akkoord met Shortcut v1, native later?
5. **EU-positionering uitspelen?** GDPR-vriendelijk, in EU gehost, geen ad-tracking — dit is een echte differentiator vs Whoop/Strava. Marketing-as-positionering of negeren?
6. **Voice-logging-prioriteit?** Stef logt zelf in Hevy op Apple Watch. Hoe groot is het pijnpunt écht? Zonder pijn niet bouwen.
7. **Bereid €15-50/user/maand Claude API-kosten te dragen bij power-users?** Bij Performance-tier kunnen tokens oplopen. Hard cap per dag/per user nodig.
8. **Brand-naam "Pulse" is generiek** (er zijn 10+ fitness apps met deze naam in App Store). App Store SEO wordt brutaal. Rebrand mogelijk?
