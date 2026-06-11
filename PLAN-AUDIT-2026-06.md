# PLAN — Grote App-Audit (10 juni 2026)

> **Hoe dit plan tot stand kwam:** 10 parallelle domein-audits (architectuur, sync, UI/UX, sportwaarde, AI, security, performance, database, testing, openstaand werk) over de hele codebase, gevolgd door adversariële verificatie van alle 32 critical/high-bevindingen door onafhankelijke reviewers die de geciteerde code zelf nalazen. 31 bevindingen bevestigd, 1 gesneuveld. Baseline: typecheck schoon, 217 unit tests groen, lint 0 errors.

> **Genomen beslissingen (Stef, 11 juni 2026):**
> 1. ✅ `planned_sessions`-tabel komt er (#38) — rijen i.p.v. JSONB-blobs.
> 2. ✅ Coach-beliefs wordt **afgemaakt**, niet geschrapt (#21).
> 3. ✅ Homescreen: **`/api/home`-endpoint nu** (#34), RSC-prefetch later als aparte stap.

## Modelkeuze per story

Elke story heeft een modeladvies. Wissel per story met `/model` vóór je begint.

| Model | Wanneer | Typisch |
|---|---|---|
| **Sonnet** | Simpel, mechanisch, afgebakend: één file of één duidelijk patroon, weinig ontwerpruimte | Config-fixes, kleine bugfixes, opruimwerk, tests schrijven op een vaste spec |
| **Opus** | Middensegment: meerdere files, vergt zorgvuldigheid maar het ontwerp ligt vast | Refactors volgens bestaand patroon, nieuwe endpoints, migratie + codepad-fix |
| **Fable** | Moeilijk, langdurig of disruptief: architectuurkeuzes onderweg, veel raakvlakken, hoge schade bij fouten | Datamodel-wijzigingen, kernberekeningen consolideren, AI-laag herontwerp |

Vuistregel: twijfel tussen twee modellen → neem de zwaardere bij alles wat data of berekeningen raakt (fout = stil corrupte cijfers), de lichtere bij UI/opruimwerk (fout = direct zichtbaar).

## Wat goed is — niet kapotmaken

- **Security-fundament:** RLS op alle 38 tabellen, constant-time webhook-auth, HMAC-signed OAuth-state, CRON_SECRET op alle crons, geen IDOR's gevonden, security headers, geen secrets in de repo.
- **Tijdzone-laag** (`lib/time/amsterdam.ts`), **Zod op externe payloads**, **block-review-domein** (dunne routes, geteste lib-laag — dit is het voorbeeldpatroon), **AI-client** met modelmix Sonnet/Haiku, **v2-tokenlaag** (globals.css volgt de canon vrijwel 1-op-1), **PWA-basis** (manifest, safe-areas, InstallPrompt), **chat-UX** (streaming, retry, 17px input), **run-matching** cross-source.

---

## Fase 0 — De cijfers moeten kloppen (stille data-corruptie) 🔴

Dit eerst: een trainings-app waarvan de getallen stil fout zijn, is waardeloos — en dit zijn allemaal bevestigde, nu-actieve bugs.

1. **HAE-datumshift (S · Sonnet):** `parser.ts:51` schuift dagmetrics (stappen, RHR, HRV) een dag terug via UTC-conversie; de fix bestaat al in `extended-parser.ts:26`. Eén gedeelde helper + backfill van historie.
2. **Hevy-webhook dupliceert sets (M · Opus):** `webhook/route.ts:114` upsert zonder unique constraints → elke redelivery verdubbelt tonnage/spierload. Migratie met `UNIQUE(workout_id, exercise_order)` + `UNIQUE(workout_exercise_id, set_order)`, webhook via dezelfde `upsertSingleWorkout()` als sync.ts.
3. **Strava-runs stil geweigerd (S · Sonnet):** `derive-runs.ts:142` insert `sport_type` ('Run', 'TrailRun') maar de CHECK-constraint accepteert alleen easy/tempo/interval/long/race → run verdwijnt geruisloos. Mapping + failure-telling.
4. **Hevy incrementele sync is een illusie (M · Opus):** `since` bestaat niet op `GET /v1/workouts` (geverifieerd tegen de live Hevy OpenAPI-spec) → elke sync herschrijft de volledige historie, "N nieuwe workouts" liegt, deletes worden nooit opgeruimd. Migreer naar `/v1/workouts/events?since=`.
5. **Laat binnenkomende data wordt nooit her-geaggregeerd (M · Opus):** alle ingest-paden hercomputen alleen "vandaag"; nightly cron alleen gisteren+vandaag. Eén helper `reaggregateDates(userId, dates[])` in alle drie de ingest-paden + rollend 7-dagen-venster in de cron.
6. **Daily aggregation bucket op UTC-dagen (S · Sonnet):** `daily.ts:53` gebruikt `T00:00:00Z`-grenzen (mét 1-seconde-gat) terwijl `startOfDayUtcIso()` ervoor bestaat. Avondsessies tellen nu bij de verkeerde dag.
7. **HAE-dedup omgekeerd (S · Sonnet):** `apple-health/route.ts:198` — workouts zónder id passeren het dedup-filter altijd. Conditie omdraaien.
8. **daily_activity NULL-overwrite (S · Sonnet):** partiële HAE-payload wist eerder ontvangen RHR/HRV (`mappers.ts:144`). Merge-update i.p.v. last-write-wins.
9. **Strava: geen automatische sync (M · Opus):** geen cron, geen webhook, `touchLastSync` is een no-op. Dagelijkse cron + `last_strava_sync_at` + re-aggregatie.
10. **Maandaggregatie telt grensweken dubbel (M · Opus):** `monthly.ts:26` — aggregeer maanden uit dagen i.p.v. weken.

## Fase 1 — Eén belastings-taal (ACWR & readiness) 🔴

11. **Drie tegenstrijdige ACWR-implementaties (L · Fable, disruptief):** weekly.ts (kalenderweek), workload-route (rolling avg), training/acwr.ts (EWMA — de goede). De Workload-pagina, coach en check-in spreken elkaar nu tegen. Maak EWMA canoniek, persisteer per dag, laat álles daaruit lezen.
12. **Halve-week-ACWR (de ergste variant) (S · Opus):** readiness + AI-context lezen op dinsdag een ACWR van ~0.3 ("fatigued") omdat de lopende kalenderweek door 7 wordt gedeeld. Quick fix vooruitlopend op #11: rollend venster gebruiken. (Klein qua diff, maar raakt readiness én coach-context — daarom Opus.)
13. **Geen chronic-ondergrens (S · Sonnet):** chronic 0 → ratio "1.0 optimal" (verzonnen). Na de vakantieweek toont de app onzin. Toon "opbouwfase — onvoldoende data" + return-to-play-modus.
14. **Load-formule herkalibreren (M · Opus):** padel telt 8x te licht (12 punten voor 90 min vs 109 voor een 5k), gym-load schaalt verkéérd met duur (langzamer = zwaarder). Per-sessie-eenheden + aparte hardloop-ACWR.
15. **Readiness v2 (L · Fable):** score gebruikt nu alleen acwr+slaap+sessie-telling; HRV/RHR/baselines/daily check-ins worden getoond maar tellen niet mee, en 3 sessies in 3 dagen geeft standaard strafpunten (voor een 4x/wk-schema de norm). Z-scores t.o.v. eigen 30d-baselines (infra bestaat al). Sport-wetenschappelijk ontwerp nodig → zwaarste model.

## Fase 2 — Kapotte loops in de UI 🔴

16. **Workout/run-detail onbereikbaar (CRITICAL, M · Opus):** de paginas bestaan en zijn af (PR's, tonnage, HR, kaart) maar er is géén enkele link naartoe — de kern-feedbackloop "trainen → resultaat zien" is letterlijk kapot. WeekGlance-pills en schema-dagen klikbaar maken + "Recente activiteiten"-lijst terug.
17. **Weesschermen (M · Opus):** Belasting, Doelen en Trends hebben nul navigatie-ingangen; het Meer-menu bevat alleen Instellingen+Uitloggen; TrendsPage heeft niet eens een route; check-in is di–vr onbereikbaar. Meer-menu vullen + /trends route.
18. **Voedingstitel hardcoded "Op koers" (S · Sonnet):** toont "Op koers" ook bij 0 kcal. Status-logica bestaat al in het dode DayIndicator.tsx.
19. **Sync-fouten onzichtbaar (M · Opus):** SyncButton meldt succes bij een 500. Fix + een `sync_runs`-tabel met status-chip ("Hevy ✓ 07:02 · Strava ⚠ 3d").
20. **Geen error.tsx op (app)-segment (S · Sonnet):** een route-fout sloopt de hele shell incl. tab bar; bovendien lekken boundaries raw `error.message`.

## Fase 3 — De coach echt slim maken 🟠

21. **Coach-beliefs afmaken (CRITICAL na verificatie, M · Fable) — ✅ besloten: afmaken.** Extractors draaien op elke chat/sync/push en kosten dagelijks Haiku-calls, maar `buildMemoryReadBlock` heeft nul callers — de AI ziet zijn eigen hypotheses nooit, en de extractors krijgen alleen tellers ("Nieuw: 2 workouts") als input. Read-block injecteren in chat + block-review, extractors voeden met échte data-samenvattingen. Raakt het hart van de AI-laag op meerdere surfaces → Fable.
22. **Chat write-backs ongevalideerd (M · Fable):** nutrition/injury/schema_update via regex op XML-tags, JSON.parse zonder Zod, fouten stil ingeslikt (`.then(() => {})`) terwijl de coach claimt dat het gelogd is, en raw tags zichtbaar tijdens streamen. Migreer naar echte AI SDK-tools (infra bestaat al; schema_generation doet het al goed). Combineer met #40 (chat-route splitsen) in één traject.
23. **Daily check-ins genegeerd (M · Opus):** "Voelen 2/5" wordt gelogd maar de coach reageert er diezelfde dag niet op. Laatste 1–3 check-ins in de chat-context + CoachCard-trigger bij voelen ≤2.
24. **Prompt-caching kapot (S · Opus):** minuut-timestamp + geheugen-reorder in het gecachte system-blok → vrijwel nul cache-hits. Statisch/dynamisch splitsen, minuten droppen. Geschat 50–70% goedkopere chat. (Klein, maar caching-semantiek is subtiel → Opus.)
25. **AI-kosten blinde vlek (S · Sonnet):** 6 routes omzeilen de centrale client (geen usage-logging) en níets leest ai_usage_log. Alles via `createJsonCompletion` + kosten-sectie in Settings.
26. **Chat-schema's kunnen stil afkappen (S · Sonnet):** maxOutputTokens 4096 in chat vs 8192 in block-review voor hetzelfde formaat. Gelijktrekken.
27. **Eval-harnas dood (S · Sonnet):** `eval:ai` wijst naar verwijderd script; 39 fixture-cases liggen ongebruikt. Minimaal herstel (classifier + golden prompts door bestaande Zod/audit).

## Fase 4 — Security (klein maar urgent) 🟠

28. **Open signup op een single-user app (HIGH, S · Sonnet):** iedereen die de URL kent kan een account maken, de app in, en jouw Anthropic-key leegtrekken. Signup uit in Supabase + route/link weg.
29. **/api/admin/seed-\* zonder owner-check (HIGH, S · Sonnet):** elke ingelogde gebruiker (zie #28) kan jouw profiel/coaching-memory overschrijven. Expliciete `user.id === PULSE_USER_ID`-check.
30. **Klein grut (S · Sonnet):** constant-time token-check in apple-health ingest, `debug`-block uit de productie-response, raw `error.message` uit 3 routes, aparte `OAUTH_STATE_SECRET`, nonce+expiry in OAuth-state, env-var i.p.v. hardcoded demo-JWT in seed-scripts.
31. **Structureel (L · Fable, disruptief, lage urgentie):** 62 routes gebruiken de service-role client (RLS is dus geen vangnet); migreer user-facing routes naar de RLS-client of een `forUser()`-helper.

## Fase 5 — Performance op de telefoon 🟡

32. **Vercel-regio pinnen (S · Sonnet):** geen `regions` in vercel.json → vermoedelijk US-East lambda's tegen een EU-Supabase. `"regions": ["fra1"]`. Mogelijk de goedkoopste grote winst van de hele lijst.
33. **Homepage-gate weg (S · Sonnet):** de hele home blokkeert op het zwáárste endpoint (`/api/schema/week`); elke card heeft al een eigen skeleton.
34. **Eén /api/home endpoint (L · Fable) — ✅ besloten: endpoint nu, RSC later.** 12+ losse client-fetches × eigen auth-roundtrip voor één scherm; het dode `/api/dashboard` was ooit precies dit. Eén endpoint met parallelle queries + alle home-hooks erop aansluiten. RSC-prefetch met SWR-fallbackData wordt een latere, aparte story.
35. **PostgREST max_rows=1000-truncatie (M · Opus):** drie progress-endpoints halen de vólledige historie op; na ~36 weken kapt PostgREST stil af en wordt de "sinds week 1"-delta gewoon fout. Aggregatietabel of `DISTINCT ON`-RPC.
36. **Klein grut (S · Sonnet):** `?detail=summary` voor schema/week op home + refreshInterval 0; dynamic import voor ChatInterface (react-markdown zit nu in élke pagina-bundle) en RouteMap (maplibre 220KB); SWR omdraaien naar revalidateOnFocus i.p.v. timers; readiness-zin persisteren in DB i.p.v. serverless Map-cache; goals-sparklines batchen; OSM raster tiles → Protomaps/MapTiler.

## Fase 6 — Architectuur-consolidatie (de duurzame winst) 🟡

37. **Eén "gepland vs gedaan"-module (L · Fable, disruptief):** het kernbegrip van de app is 4x onafhankelijk gebouwd (schema, schema/week, check-in/review, block-review) met 6 ad-hoc parsers van het workout_schedule-blob — home en weekly review kunnen elkaar nu tegenspreken. Eén `lib/training/schedule.ts` op basis van het bestaande program-contract, met tests. Bouw dit bovenop #38.
38. **planned_sessions-tabel (XL · Fable, disruptief) — ✅ besloten: ja.** Het trainingsplan leeft in 4+ JSONB-blobs; "gepland vs gedaan", adherence en skip-patronen zijn niet in SQL te beantwoorden en blob-chirurgie ging al bewijsbaar mis (cleanup-script bestaat). Rijen i.p.v. blobs maakt #37, adherence, check-in en block-review fundamenteel simpeler. Het zwaarste en belangrijkste architectuurwerk van dit plan: migratiestrategie + alle lezers/schrijvers omzetten → Fable, in kleine reviewbare stappen.
39. **Check-in lib-laag (L · Opus):** 4 route-files van 400–574 regels met inline domeinlogica, ontestbaar. Block-review-patroon als huisstijl: route = auth + zod + lib-call. (Veel werk, maar het patroon ligt vast → Opus.)
40. **Chat-route splitsen (M · Fable):** 774 regels, twee concurrerende write-back-mechanismen — voer dit uit als onderdeel van #22.
41. **Dead code ruimen (S · Sonnet):** 6 complete dode ketens (waaronder een AI-aanroepende route), ~85% van context-assembler.ts (996 regels) is gemarkeerd-legacy, ~23 dode componenten met deprecated kleuren, v1 UI-kit naast v2 op hetzélfde scherm. `npx knip` als wekelijkse check.
42. **Route-helpers + API-client (M · Opus):** het auth-blok is 80x gekopieerd, 11 routes hebben een afwijkend error-contract, 46 lokale SWR-fetchers. `requireUser()`/`jsonError()` + één `apiGet/apiPost`.
43. **Repo-hygiëne (S · Sonnet):** de geneste 2,3GB `pulse/`-kopie weg (divergente doc-boom!), screenshots/`files lichaam/` archiveren, `plan-stef-week5-8.md` + APP-OVERVIEW committen, deprecated PULSE-DESIGN-SYSTEM.md echt verwijderen, backlog-statussen bijwerken (10 stories staan op "todo" maar zijn af), CLAUDE.md actualiseren (zegt nog Next 14 / verouderd model / "geen tests").

## Fase 7 — Vangnet (testing & CI) 🟡

44. **CI (S · Sonnet, hoogste prioriteit hier):** er draait letterlijk níets bij een push. GitHub Action met `pnpm test` + `pnpm typecheck` — 15 minuten werk.
45. **Tests voor de 6 ongeteste kernberekeningen (M · Opus):** muscle load, movement volume, training load score, burn-tier (boundaries!), HAE-datum/kJ-conversie, Hevy fuzzy-matching (bepaalt data-integriteit, partial-match op "Row" is ambigu). Plus `amsterdam.ts` (zomertijd-overgang) en e1RM extraheren naar `lib/training/e1rm.ts`. (Tests schrijven is mechanisch, maar het vastleggen van het juíste verwachte gedrag van berekeningen vergt zorg → Opus.)
46. **E2E reanimeren (S · Sonnet):** specs skippen allemaal op ontbrekende TEST_USER_EMAIL/PASSWORD; documenteer in .env.local.example. Eén happy-path E2E voor de block-review-wizard (daar zaten alle 9 hotfixes).
47. **Seeds bijwerken (S · Sonnet):** walks/strava/coach_beliefs/program_proposal_v2 ontbreken in de seed-scripts.

## Fase 8 — Van dashboard naar onmisbare coach (product) 🟢

48. **e1RM als primaire progressielijn (M · Opus):** bij double progression oogt de grafiek nu wekenlang vlak; e1RM bestaat al maar zit verstopt in block-review. Dé feature waarvoor een lifter dagelijks terugkomt. Fix ook de BigLifts-kaart ("laatste 8 weken" toont all-time).
49. **PR-detectie uitbreiden (M · Opus):** alleen max-gewicht telt nu; rep-PR's, e1RM-PR's en running-PB's (snelste 5k/10k, langste run) bestaan niet — een hypertrofieblok levert zo nooit een gevierd PR op.
50. **Hardloop-modaliteit volwaardig (L · Fable):** geen splits, geen HR-zones, geen pace@HR-trend, geen PB-lijst — voor de gym is Pulse rijk, voor het hardlopen een lege huls. Strava laps + HR-streams ophalen. Nieuw feature-domein met product- én datamodelkeuzes → Fable.
51. **Goals koppelen aan oefeningen (M · Opus):** de `goals`-tabel hééft geen oefening-koppeling (audit-claim hierover was deels onjuist; de echte fix is een `exercise_definition_id`-kolom + gefilterde auto-track).
52. **Prescriptieve laag (L · Fable):** strain target + sleep score/bedtime uit je eigen opportunity-research (#3/#4) — alle data is al aanwezig; dit is het verschil tussen "data kijken" en "weten wat te doen". Vergt sport-wetenschappelijk ontwerp van de targets → Fable.
53. **Spiergroep-mapping verfijnen (M · Opus):** deadlift telt als "core", adductors als "hip_flexors", is_compound altijd false; week-spierload sommeert genormaliseerde dagwaarden (wiskundig betekenisloos). Override-tabel voor de ~30 meest getrainde oefeningen.
54. **Canon-restjes (M · Sonnet):** movement-pattern chart + running-progressie op Progress, Mineral-kleuren uit ProteinTracker/trends, text.tertiary AA-fix (1 regel), Meer-menu → Settings als grouped-rows-hub, 44px tap targets. (Mechanisch UI-werk tegen een vastliggende canon.)

---

## Aanbevolen volgorde

| Sprint | Inhoud | Dominant model | Waarom eerst |
|---|---|---|---|
| **1. Vertrouwen** | Fase 0 + #12/#13 + #28/#29 + #44 | Sonnet/Opus | Foute cijfers en open voordeur zijn onacceptabel; CI voorkomt regressie tijdens de rest |
| **2. Voelbaar** | Fase 2 + #32/#33 + #24 | Sonnet/Opus | Grootste merkbare sprong voor de gebruiker, klein werk |
| **3. Eén taal** | #11/#14/#15 + #45 | Fable + Opus | ACWR/readiness overal consistent, hard getest |
| **4. Coach** | Fase 3 (#21/#22 voorop) | Fable | De AI-laag van "praat mee" naar "kent mij" |
| **5. Fundament** | Fase 6 (#38 → #37 → rest) + Fase 7-rest | Fable + Opus | Maakt al het latere werk goedkoper |
| **6. Volgende level** | Fase 8 | Opus/Fable | Nieuwe waarde bovenop een kloppend fundament |

**Werkafspraak modellen:** per story het geadviseerde model kiezen via `/model`; binnen een sprint mag je batches van Sonnet-stories achter elkaar doen. Bij een story die onverwacht complexer blijkt (architectuurkeuze duikt op, meer raakvlakken dan gedacht): stop, schaal op naar het zwaardere model, en ga verder.
