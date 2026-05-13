# Pulse — Alle Fixes op een rij (single-user scope)

**Datum:** 2026-05-13
**Scope-filter:** alleen jij gebruikt de app. Multi-tenant / billing / onboarding-wizards / 100-user-kosten zijn eruit gefilterd. Wat overblijft: **veiligheid, bugs, data-integriteit, productie-stabiliteit voor jou alleen, en kwaliteit van de AI-coach.**

**Hoe te lezen:**

- Elke fix heeft een korte **technische titel** + **jip-en-janneketaal-uitleg** (wat betekent dit nou echt?) + **severity** + **effort** + **bron-rapport**.
- Severity: P0 = nu fixen, P1 = deze maand, P2 = wanneer 't uitkomt, P3 = nice to have.
- Effort: XS = < 30 min, S = 30 min–2 uur, M = halve dag, L = volledige dag of meer.
- Aan het einde een prioriteringstabel waar je een vinkje achter kan zetten.

---

## A. VEILIGHEID (security)

Ook voor jou alleen relevant. Een XSS-gat in je eigen app betekent dat een kwaadaardige Hevy/Apple-Health waarde via Claude jouw browser-sessie kan kapen of cookies kan stelen.

### A1. `react-markdown` zonder sanitize — XSS via prompt injection ⚠️
- **Tech:** `src/components/chat/ChatMessage.tsx:28` rendert AI-output met `react-markdown` zonder `rehype-sanitize` plugin.
- **Jip-en-janneketaal:** Je AI-coach drukt z'n antwoorden af als opgemaakte tekst. Als iemand jouw Hevy-account of een Apple Health-veld kan vullen met `<script>`-code, kan Claude die per ongeluk meeschrijven, en jouw browser voert het uit. Dat kan je session-cookie stelen en daarmee je hele Supabase-account openzetten.
- **Severity:** P0 — XSS is een klassieke aanvaller-route.
- **Effort:** XS (30 min). Diff staat al klaar: `prs/003-sanitize-chat-markdown-xss.diff`.
- **Bron:** Fase 4 (SEC-03).

### A2. `/api/admin/seed-memory` is publiek bereikbaar
- **Tech:** `src/app/api/admin/seed-memory/route.ts:4-9` doet alleen een env-var lookup, geen auth-check.
- **Jip-en-janneketaal:** Er staat een URL in productie waar iedereen op het internet je coaching-geheugen kan overschrijven (jouw blessures, voorkeuren, lessons learned). Geen wachtwoord, geen token, geen niks.
- **Severity:** P0.
- **Effort:** XS (15 min). Kopieer de `CRON_SECRET` Bearer-check uit `src/app/api/cron/*/route.ts`.
- **Bron:** Fase 4 (SEC-02).

### A3. Next.js 16.2.1 heeft 6 HIGH CVE's
- **Tech:** `package.json:25` — onder andere DoS via Server Components, SSRF via WebSocket, middleware/proxy bypass via dynamic route injection.
- **Jip-en-janneketaal:** Het framework waarop Pulse draait heeft bekende lekken waarvan de fix al beschikbaar is. Aanvallers scannen het internet op oude Next.js-versies. Eén `pnpm update next` lost dit op.
- **Severity:** P0.
- **Effort:** XS (5 min update + testen). Check daarna of `/middleware.ts` bestaat en nog werkt.
- **Bron:** Fase 4 (SEC-04).

### A4. Hevy API-key, HAE-token, Google refresh-token = plaintext in DB
- **Tech:** `supabase/migrations/20260101000001_initial_schema.sql:20` + `20260101000010_google_calendar_tokens.sql`. Velden `hevy_api_key`, `health_auto_export_token`, `google_calendar_refresh_token` zijn `TEXT` zonder encryption.
- **Jip-en-janneketaal:** Als iemand ooit toegang krijgt tot je Supabase-database (Stef vergeet zich uit te loggen op een coffeeshop-laptop, een Supabase-medewerker doet iets verkeerd, een DB-dump lekt op Github), heeft die direct toegang tot alle jouw verbonden accounts. Zelfs Supabase-medewerkers zouden ze niet moeten kunnen lezen.
- **Severity:** P1 (was P0 maar voor single-user iets minder urgent — het risico is jouw eigen DB).
- **Effort:** M (halve dag). Supabase Vault gebruiken (vereist Pro plan), of encrypten op applicatie-niveau met een key uit `.env`.
- **Bron:** Fase 4 (SEC-05).

### A5. `createClient()` retourneert overal de service-role (RLS bypass)
- **Tech:** `src/lib/supabase/server.ts:8-21` mutates `admin.auth.getUser` runtime; alle server-side routes draaien dus als god-mode user.
- **Jip-en-janneketaal:** Supabase heeft een ingebouwde beveiligingslaag (RLS = row-level security) die ervoor zorgt dat user X de data van user Y niet kan zien. Pulse zet die laag effectief uit voor elke API-route. Voor jou alleen geen probleem nu — maar één bug waardoor `PULSE_USER_ID` per ongeluk verkeerd staat, en je app leest data van een andere `user_id` zonder enige check.
- **Severity:** P2 (voor single-user-scope laag, want jij bent de enige user).
- **Effort:** L (1 dag). Maak een echte SSR-client naast de admin-client; gebruik admin alleen waar nodig (crons, ingest).
- **Bron:** Fase 4 (SEC-01).

### A6. RLS-policies op 4 tabellen mogelijk te ruim
- **Tech:** `coaching_memory`, `hevy_routines`, `sleep_logs`, `body_weight_logs` hadden `USING (true)` policies; migratie `20260404000002` repareert dit, maar verificatie ontbreekt.
- **Jip-en-janneketaal:** Zie A5 — je RLS staat goed gedefinieerd, maar voor 4 tabellen weten we niet zeker of de fix-migratie ooit is gedraaid op productie. Eén SQL-query laat het zien.
- **Severity:** P2.
- **Effort:** XS (5 min). Run in Supabase SQL editor: `SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE tablename IN ('coaching_memory','hevy_routines','sleep_logs','body_weight_logs');` en bevestig dat alles `{service_role}` is.
- **Bron:** Fase 4 (SEC-07, SEC-08).

### A7. Hevy webhook gebruikt string-vergelijking voor secret (timing attack)
- **Tech:** `src/app/api/ingest/hevy/webhook/route.ts:25-38` doet `if (header === expected)` ipv `crypto.timingSafeEqual`.
- **Jip-en-janneketaal:** Wachtwoord-vergelijkingen kunnen "lekken" via de tijd die het duurt om te falen. Theoretisch kan een aanvaller letter voor letter het secret raden. Voor een webhook minder ernstig dan een login, maar de fix is een one-liner.
- **Severity:** P3.
- **Effort:** XS (5 min).
- **Bron:** Fase 4 (SEC-06).

### A8. Apple Health ingest lekt PHI naar Vercel-logs
- **Tech:** `src/app/api/ingest/apple-health/route.ts:155-166` — drie `console.log` calls die `bodyComp` entries en parse-resultaten loggen.
- **Jip-en-janneketaal:** Elke keer als je Apple Watch data uploadt, wordt je gewicht, vetpercentage en spiermassa naar de Vercel-logs gepompt. Vercel-logs zijn alleen voor jou zichtbaar, maar ze worden bewaard en kunnen via "Share log" per ongeluk gedeeld worden. Dit is debug-code die vergeten is.
- **Severity:** P0 (snelheid van fix maakt 't bijna gratis).
- **Effort:** XS (2 min). Verwijder regels 155-166.
- **Bron:** Fase 1 (P0 finding), Fase 4 (SEC-18).

### A9. Apple Health ingest retourneert intern datamodel in response
- **Tech:** `src/app/api/ingest/apple-health/route.ts:541-545` stuurt een `debug` object terug met metric-namen en parse-counts.
- **Jip-en-janneketaal:** De HAE-app op je telefoon krijgt elke keer een lijstje terug met "intern keukengeheim" — welke metrics Pulse herkent, hoe het parst, etc. Niet kritiek, maar onnodig.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 4 (SEC-09).

### A10. `OAUTH_STATE_SECRET` deelt key met `CRON_SECRET`
- **Tech:** `src/lib/google/oauth.ts:7-11` gebruikt `CRON_SECRET` als HMAC-key voor de Google-OAuth state.
- **Jip-en-janneketaal:** Als één van die twee secrets lekt, lekken ze beide. Maak gewoon een tweede env var aan.
- **Severity:** P2.
- **Effort:** XS.
- **Bron:** Fase 4 (SEC-12).

### A11. `extractWritebacks` parst AI-output zonder strenge validatie
- **Tech:** `src/app/api/chat/route.ts:65-105`. Claude kan via XML-tags injuries, nutrition_logs en schema's schrijven; validatie is laks.
- **Jip-en-janneketaal:** Als Claude in de war raakt door een rare Hevy-naam of een prompt-injection, kan hij per ongeluk een blessure-log of een heel trainingsschema aanmaken in jouw DB. Geen strikte schema-check.
- **Severity:** P1.
- **Effort:** M (halve dag). Vervang door echte AI SDK tools met Zod-validatie. Zie ook B7.
- **Bron:** Fase 4 (SEC-15), Fase 2 (sectie 5.1).

---

## B. AI-LAAG (jouw belangrijkste klachtgebied)

### B1. Geen eval-harness — je kunt prompt-tweaks niet meten
- **Tech:** Er is geen testset voor de classifier, tool-routing, of prompt-regressies.
- **Jip-en-janneketaal:** Elke keer als jij een woordje in de system-prompt verandert, weet je niet of het beter is geworden. Misschien classificeert Claude "hoeveel eiwit in kwark?" nu wel goed, maar reageert hij ineens dom op "ik heb pijn in mijn schouder". Een eval-harness is een lijst met 30 voorbeeld-vragen + verwachte antwoorden die je in 5 seconden draait om te zien of een tweak iets verbroken heeft. Dit is waarom je geen vertrouwen hebt in de AI: geen meetstok.
- **Severity:** P1.
- **Effort:** M (halve dag voor de basis-harness). Diff staat al klaar: `prs/002-add-ai-eval-harness.diff`.
- **Bron:** Fase 2 (sectie 7).

### B2. Classifier mist edge cases ("kwark + eiwit", "gisteren X kcal")
- **Tech:** `src/lib/ai/classifier.ts:87-92`. Volgorde van keyword-checks zorgt voor verkeerde routing.
- **Jip-en-janneketaal:** De classifier (= het stukje code dat beslist "is dit een voedingsvraag of een blessure-melding?") gebruikt simpele woordlijstjes. Daardoor:
  - "hoeveel eiwit zit in kwark?" → wordt gezien als een maaltijd-log (Claude probeert 't dus op te slaan ipv te beantwoorden).
  - "gisteren 3000 kcal binnen" → valt door als general chat (Claude vraagt niet om context).
  - "rdl ging beter dan vorige keer" → geen progressie-context geladen.
- **Severity:** P1.
- **Effort:** S–M. Twee opties: (a) regex-volgorde fixen + tests toevoegen, of (b) Haiku als classifier gebruiken.
- **Bron:** Fase 2 (sectie 3.1).

### B3. Twee parallelle write-paden naast elkaar (Zod-tools + XML-blokken)
- **Tech:** Read-tools gaan via AI SDK met Zod. Write-tools gaan via XML-tags die met regex worden geparsed. Bij parse-fout: stil weg.
- **Jip-en-janneketaal:** Als Claude een maaltijd voor je wil loggen, schrijft hij een `<nutrition_log>{...}</nutrition_log>` blok. Een stukje regex pakt dat eruit, parset het JSON, en stopt het in de DB. Als Claude één komma vergeet → de regex faalt → er gebeurt niks → jij denkt dat 't gelogd is. **Stille data-loss.** De fix: gebruik echte AI SDK tools (zoals voor reads al gebeurt), dan dwingt Anthropic zelf de juiste structuur af.
- **Severity:** P1.
- **Effort:** M. Refactor de 4 XML-write-paden naar tools.
- **Bron:** Fase 2 (sectie 5.1), Fase 1 (P1 #4).

### B4. 988-regel context-assembler waarvan 700+ regels dood
- **Tech:** `src/lib/ai/context-assembler.ts` — `assembleContext()` en alle type-specifieke builders worden niet meer aangeroepen. Alleen `assembleThinContext` is in gebruik.
- **Jip-en-janneketaal:** Een grote berg code die niemand meer aanroept. Verwarrend bij debuggen, en het maakt de codebase 700 regels groter zonder doel. Gewoon weghalen.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 2 (sectie 1).

### B5. `loadCoachingMemory` heeft geen limit
- **Tech:** `src/lib/ai/context-assembler.ts:865-871` — laadt alle coaching memories zonder cap.
- **Jip-en-janneketaal:** Het AI-geheugen groeit elke dag (nieuwe insights uit chat, sync-analyst). Na 6 maanden heb je 200+ memories. Die gaan elke chat-request mee als context naar Claude. Dat zit dichter bij token-overflow én Claude verliest focus. Cap op 30 meest recent.
- **Severity:** P1.
- **Effort:** XS (één `.limit(30)` toevoegen).
- **Bron:** Fase 2 (sectie 6.1).

### B6. Twee verschillende weekly-review prompts met afwijkende formats
- **Tech:** `src/lib/ai/prompts/weekly-summary.ts` (markdown via chat) vs `src/lib/ai/prompts/checkin-analyze.ts` (JSON via check-in).
- **Jip-en-janneketaal:** Als jij in chat "evalueer mijn week" typt, krijg je een markdown-overzicht met emoji's. Als je dezelfde vraag stelt via de wekelijkse check-in flow, krijg je een gestructureerd JSON-resultaat. Verschillende contracten, verschillende kwaliteit. Eén kiezen, andere weghalen.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 2 (sectie 2.6).

### B7. Geen tools voor body composition / active schema / injury history / weekly aggregations
- **Tech:** `src/lib/ai/tools/definitions.ts` mist tools voor o.a. `get_body_composition`, `get_active_schema`, `get_injury_history`, `get_weekly_aggregations`.
- **Jip-en-janneketaal:** Als jij vraagt "hoe gaat mijn vetpercentage?" — Claude heeft daar geen tool voor. Hij raadt op basis van de algemene system-prompt (die niet altijd je laatste InBody-scan bevat). Voeg de ontbrekende read-tools toe en Claude kan precies de juiste data ophalen.
- **Severity:** P1.
- **Effort:** M (4 tools à 30 min).
- **Bron:** Fase 2 (sectie 3.2).

### B8. Conversation history zonder samenvatting (cut-off na 20 turns)
- **Tech:** `src/app/api/chat/route.ts:202-211` — laatste 20 berichten, geen compressie.
- **Jip-en-janneketaal:** Bij een lang gesprek (40 berichten verspreid over een week) verlies je context na turn 20. Claude weet niet meer wat je 25 berichten geleden zei. Bij >15 turns: laat Haiku een korte samenvatting maken van de oudste 10 en vervang die door één system-note.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 2 (sectie 3.5).

### B9. `result.usage` faal kapt hele DB-save af
- **Tech:** `src/app/api/chat/route.ts:266` — als token-usage opvragen faalt, faalt ook de save van het chat-antwoord en eventuele schema write-back.
- **Jip-en-janneketaal:** Eén klein meet-foutje en je hele Claude-antwoord wordt niet opgeslagen. Wrap in try/catch met fallback `0`.
- **Severity:** P2.
- **Effort:** XS.
- **Bron:** Fase 2 (sectie 4.3).

### B10. Memory-extractor draait fire-and-forget zonder telemetrie
- **Tech:** `src/lib/ai/memory-extractor.ts:55` — geen log, geen retry, geen visibility of het werkt.
- **Jip-en-janneketaal:** Na elke chat-turn draait een Haiku-call die nieuwe coaching-feiten uit je gesprek probeert te halen. Als die faalt, merk jij dat niet. Voeg minimaal een `console.error` toe + log naar Sentry zodra dat er staat.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 2 (sectie 2.8).

### B11. Persoonlijke data hardcoded in system prompt (drift met DB)
- **Tech:** `src/lib/ai/prompts/chat-system.ts:16-143` heeft je leeftijd, lengte, blessures, schema-tabel, InBody-scans als statische tekst.
- **Jip-en-janneketaal:** Je profiel staat op twee plekken (system-prompt + database). Als je in de database iets wijzigt (gewicht, blessure), gaat de system-prompt achterlopen. Drift = bug. Maak deze sectie dynamisch (uit de DB ophalen bij elke request) of gebruik tools om het op te halen.
- **Severity:** P2.
- **Effort:** M.
- **Bron:** Fase 2 (sectie 2.1).

### B12. Geen response-length policy in chat-system prompt
- **Tech:** Geen instructie over antwoordlengte in `chat-system.ts`. Claude default produceert 400-800 tokens per turn.
- **Jip-en-janneketaal:** Claude is doorgaans erg uitgebreid. Een coach-app wil korte, scherpe antwoorden (2-6 zinnen). Voeg een sectie toe: "max 100 woorden, geen 'laat me weten als je vragen hebt'-afsluiters".
- **Severity:** P2.
- **Effort:** XS.
- **Bron:** Fase 2 (sectie 2.1).

---

## C. CHECK-IN BUG (specifiek door jou aangekaart)

### C1. Wekelijkse check-in plant verkeerde week 🔴
- **Tech:** `src/components/check-in/CheckInFlow.tsx:270-271` geeft `data.week.weekStart` / `data.week.weekEnd` (= de week die je reviewt) één-op-één door aan `<WeekPlanCard>`. Geen +7-dagen offset.
- **Jip-en-janneketaal:** Wanneer je op zondagavond je check-in doet:
  - Stap 1-2 (review + analyze) kijken naar de afgelopen week — klopt.
  - Stap 3 (plannen) zou de **komende** week moeten plannen — maar de wizard plant dezelfde week opnieuw (die al voorbij is). Resultaat: jouw Google Calendar krijgt afspraken met datums in het verleden, en je `scheduled_overrides` worden op de verkeerde dagen geschreven.
- **Bonus-bug:** `getWeekStart` werkt op UTC. Als je op maandagochtend 01:30 incheckt, denkt UTC nog dat het zondag is en pakt de week ervóór. Op DST-grenzen (eind maart en eind oktober) kan dat extra raar uitpakken.
- **Severity:** P0.
- **Effort:** M. Diff staat al klaar: `prs/001-fix-checkin-week-calculation.diff`.
- **Bron:** Fase 8 (volledige RCA).

---

## D. CODE-KWALITEIT & BUGS (functioneel)

### D1. `formatDate`, `formatTime`, `formatWeek` etc. 6× gedupliceerd
- **Tech:** 6+ components hebben byte-voor-byte identieke `formatDate` functies.
- **Jip-en-janneketaal:** Als je de datum-weergave wilt aanpassen ("Mon" → "ma"), moet je dat op 6 plekken doen. Onvermijdelijk gaan plekken uit de pas lopen → UI-inconsistencies. Maak `src/lib/formatters.ts` met alle helpers, importeer overal vandaan.
- **Severity:** P1.
- **Effort:** S.
- **Bron:** Fase 1 (P1 #5).

### D2. `getISOWeekNumber` 4× anders geïmplementeerd
- **Tech:** Bestaat in `status/route.ts`, `review/route.ts`, `schema/SchemaWeekView.tsx`, `aggregations/weekly.ts` — drie verschillende signatures.
- **Jip-en-janneketaal:** Vier mensen (lees: vier copy-pastes uit chatGPT) hebben week-nummers anders gebouwd. Jaarwisseling kan dus per scherm anders zijn ("week 53" vs "week 1"). Eén implementatie kiezen, rest weggooien. Wordt al gedaan in de check-in-fix (`src/lib/dates/week.ts`), maar ook gebruiken in de andere 3 plekken.
- **Severity:** P1.
- **Effort:** S.
- **Bron:** Fase 1 (P1 #6), Fase 8.

### D3. `as unknown as` op 16 plekken (Supabase joins zonder validatie)
- **Tech:** O.a. `src/app/api/progress/exercise/route.ts:80`, `src/app/api/chat/route.ts:429`. Supabase join-resultaten worden gecast zonder Zod-check.
- **Jip-en-janneketaal:** Bij sommige Supabase-queries vertelt de code aan TypeScript "vertrouw me, dit type klopt", zonder echte check. Als de DB-structuur ooit verandert (kolomnaam, type), crasht de app pas in productie. Met Zod erbij: of meteen errors in TypeScript, of een nette validatie-fout aan de gebruiker.
- **Severity:** P2.
- **Effort:** L (~16 plekken).
- **Bron:** Fase 1 (P1 #1).

### D4. `extractWritebacks` met stille `catch {}` blokken
- **Tech:** `src/app/api/chat/route.ts:67-105` — vier try/catch met lege body, comment `// ignore malformed JSON`.
- **Jip-en-janneketaal:** Zie B3. Als Claude een maaltijd-log produceert met ongeldige JSON, wordt 't stil weggegooid. Voeg minimaal `console.error` toe.
- **Severity:** P1.
- **Effort:** XS.
- **Bron:** Fase 1 (P1 #4).

### D5. `useEffect` om props naar state te kopiëren (React anti-pattern)
- **Tech:** `src/components/settings/SettingsPage.tsx:75-88` (8x setState in 1 effect), `AIContextSection.tsx:17-19`, `WeekPlanCard.tsx:384-389`.
- **Jip-en-janneketaal:** Een veel-voorkomende React-fout: gebruik `useEffect` om data uit props in local state te stoppen. Veroorzaakt extra renders en "stale state" bugs als de prop snel verandert (bv. snelle data-refresh).
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 1 (P2 #2).

### D6. `key={index}` op dynamische lijsten (niet skeletons)
- **Tech:** `src/components/schema/DayDetailSheet.tsx:85`, `src/components/progress/ProgressionChart.tsx:196`, `src/components/check-in/WeekReviewCard.tsx:256`.
- **Jip-en-janneketaal:** Wanneer je een lijst sorteert of filtert, gebruikt React de `key` om te weten welk item welk DOM-element heeft. Bij `key={index}` raakt dat in de war — visueel resultaat: state van item A komt op item B terecht (bv. open/dichte details). Vervang door een stabiele ID (exercise-naam, workout-ID).
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 1 (P2 #3).

### D7. `SchemaPageContent` doet twee API-calls voor overlappende data
- **Tech:** `src/components/schema/SchemaPageContent.tsx:42-43` — `useSchema` én `useSchemaWeek`.
- **Jip-en-janneketaal:** Eén component vraagt zowel `/api/schema` als `/api/schema/week` op. Die endpoints overlappen. Onnodige dubbele DB-load.
- **Severity:** P2.
- **Effort:** M.
- **Bron:** Fase 1 (P2 #6).

### D8. `CoachAnalysisCard` rebuildt SWR ad-hoc + heeft retry-bug
- **Tech:** `src/components/check-in/CoachAnalysisCard.tsx:37-73` — custom `useEffect` + `useRef(hasFetched)` patroon; `handleRetry()` zet `hasFetched.current = false` tweemaal achter elkaar.
- **Jip-en-janneketaal:** Iemand heeft hier handmatig opnieuw bedacht wat SWR al kan. Plus een copy-paste bug. Gebruik gewoon SWR.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 1 (P2 #7).

### D9. Types worden uit `route.ts` geëxporteerd → component-koppeling
- **Tech:** `CheckInReviewData`, `AnalyzeResponse`, `PlannedSession`, `WeekPlan` etc. zitten in API route files; 5+ components importeren ze van daar.
- **Jip-en-janneketaal:** Als je een API-route hernoemt of splitst, breken alle component-imports. Verplaats deze types naar `src/types/` of `src/lib/schemas/`.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 1 (P2 #8).

### D10. Sport-types `'gym' | 'run' | 'padel'` 10+ keer als inline literal
- **Tech:** Geen centrale definitie. Als je 'cycle' wilt toevoegen, 10 bestanden aanpassen.
- **Jip-en-janneketaal:** Maak `src/lib/constants.ts` met `SPORT_TYPES`, `SportType`, `SportTypeSchema`. Eén bron van waarheid.
- **Severity:** P3.
- **Effort:** S.
- **Bron:** Fase 1 (P3 #3).

### D11. `src/proxy.ts` ongebruikt
- **Tech:** Bestand in `src/` root, geen enkele import.
- **Jip-en-janneketaal:** Hoogstwaarschijnlijk vergeten development-tooltje. Verwijder als niets erop wijst.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 1 (P3 #2).

### D12. `src/components/muscles/bodyMapData.ts` staat in components/ maar is data
- **Tech:** Pure data-file (SVG paths) in een components-map.
- **Jip-en-janneketaal:** Verplaats naar `src/lib/body-map/data.ts`. Codestructuur klopt dan beter.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 1 (P3 #1).

### D13. `hevyFetch<T>` doet cast zonder Zod
- **Tech:** `src/lib/hevy/client.ts:53` — `return response.json() as Promise<T>`.
- **Jip-en-janneketaal:** Theoretisch onveilig: als iemand straks `hevyFetch<HevyWorkout>` aanroept, slaat Zod-validatie over. Nu pakken alle callers `hevyFetch<unknown>` dus toevallig OK. Verwijder de generic; dwing Zod af.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 1 (P2 #5).

### D14. 80+ componenten hebben `"use client"` zonder reden
- **Tech:** Pure presentational components (geen state, geen handlers) hebben toch de directive — o.a. `TodayWorkoutCard`, `WeekAtAGlance`, `AdherenceTracker`, `MuscleGroupDot`.
- **Jip-en-janneketaal:** Next.js heeft Server Components (RSC) die in HTML aankomen zonder JS. Pure render-componenten zonder klikgedrag kunnen RSC zijn → minder JS in je bundle. Niet wereldschokkend, maar nettere architectuur.
- **Severity:** P3.
- **Effort:** M (incrementeel mogelijk).
- **Bron:** Fase 1 (P2 #1), Fase 5 (sectie 8).

### D15. `ProgressPage` gebruikt `useEffect` om eerste oefening te selecteren
- **Tech:** `src/components/progress/ProgressPage.tsx:37-41`.
- **Jip-en-janneketaal:** Bereken inline: `const activeExercise = selectedExercise ?? exercises[0]?.name ?? null`. Eén render minder.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 1 (P3 #5).

### D16. Settings-save toont geen error aan gebruiker bij fail
- **Tech:** `src/components/settings/SettingsPage.tsx:90-136` — `throw new Error()` zonder bericht, geen catch in component.
- **Jip-en-janneketaal:** Je klikt "Opslaan" → de knop gaat in pending → er gebeurt niks → je weet niet of het gelukt is. Voeg een toast/inline-error toe.
- **Severity:** P3.
- **Effort:** S.
- **Bron:** Fase 1 (P3 #6).

---

## E. UI/UX

### E1. Lege homepage voor jou na een 'reset' (geen data-dag)
- **Tech:** `DashboardPage.tsx` — `TodayWorkoutCard`, `ReadinessSignal`, `WeekAtAGlance`, `DailyHealthBar` retourneren allemaal `null` zonder data.
- **Jip-en-janneketaal:** Stel: Apple Watch laadt 1 dag niet → de homepage kan veranderen in een rij grijze plekken. Niet kritiek voor jou, maar lelijk en verwarrend. Geef elke kaart een eigen empty state of skeleton.
- **Severity:** P1.
- **Effort:** M.
- **Bron:** Fase 3 (Home), Fase 7 hoofdkritiek.

### E2. `ReadinessSignal` rendert `null` tijdens laden → layout shift
- **Tech:** `DashboardPage.tsx:110`. De skeleton voor de pagina mist een placeholder voor de readiness-banner.
- **Jip-en-janneketaal:** De rest van de homepage is al zichtbaar terwijl readiness nog laadt → de banner springt erbij → andere kaarten verschuiven. Storend op de meest belangrijke kaart van de app. Vervang `return null` door een eigen skeleton.
- **Severity:** P1.
- **Effort:** XS.
- **Bron:** Fase 3 (Home #1).

### E3. `themeColor` = light-mode iOS kleur (statusbalk ziet er fout uit)
- **Tech:** `src/app/layout.tsx:26` — `themeColor: '#F2F2F7'` (iOS light-mode achtergrond).
- **Jip-en-janneketaal:** Bij installatie als PWA op iOS toont de statusbalk een lichte kleur boven een donkere app. Verander naar `'#15171F'` (v2 design tokens).
- **Severity:** P2.
- **Effort:** XS (1 regel).
- **Bron:** Fase 3 (cross-cutting #3).

### E4. Dubbele bottom padding op 5 routes
- **Tech:** `layout.tsx:39` doet `pb-[83px]`. `schema/page.tsx:5`, `ProgressPage.tsx:47`, `GoalsPage.tsx:42`, `NutritionPage.tsx:75`, `WorkloadPage.tsx:104` voegen óók `pb-24` toe = ~180px lege ruimte onderaan.
- **Jip-en-janneketaal:** Onderaan elke pagina (op mobiel) is een dikke lege strook. Verwijder `pb-24` op alle vijf.
- **Severity:** P2.
- **Effort:** XS.
- **Bron:** Fase 3 (cross-cutting #2).

### E5. Tap targets <44px op meerdere knoppen
- **Tech:** "Nieuwe sessie" in chat (`ChatPage.tsx:28`, py-1.5 ≈ 24px), terug-knop in check-in (`CheckInFlow.tsx:80`, h-8 w-8 = 32px), terug-link in belasting (`WorkloadPage.tsx`), "Doel toevoegen" in goals (`GoalsPage.tsx:47`).
- **Jip-en-janneketaal:** iOS HIG zegt: knoppen ≥ 44px hoog/breed. Daaronder is precies tikken lastig (zeker met natte/grote vingers). Verhoog padding of voeg `min-h-[44px]` toe.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 3.

### E6. Design tokens v2 niet doorgevoerd (316 v1-references)
- **Tech:** Alle componenten gebruiken `system-blue`, `system-green` (v1 Apple HIG) ipv `sport-gym-base #00E5C7`, `sport-run-base #FF5E3A`, `brand-claude #D97757` (v2 spec in `pulse/design/design_handoff_pulse_v2/`).
- **Jip-en-janneketaal:** Je hebt een v2-design uitgewerkt, maar de app gebruikt nog de v1-kleuren. Verschil is fundamenteel — gym is teal in v2, blauw in v1. Migratie kan stapsgewijs.
- **Severity:** P2.
- **Effort:** L (incrementeel mogelijk).
- **Bron:** Fase 3 (cross-cutting #1).

### E7. Geen `CoachOrb` component
- **Tech:** Handoff-spec definieert `CoachOrb` als visueel anker voor AI; chat-pagina heeft alleen tekstlabel.
- **Jip-en-janneketaal:** Het ronde coral oranje cirkeltje dat overal AI-momenten markeert (op chat, in insights, naast nudges) bestaat niet als component. Bouw `<CoachOrb />` en gebruik 'm op chat-header + insight-cards.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 3 (Chat #2).

### E8. ChatSuggestions zijn statisch (niet context-gevoelig)
- **Tech:** `src/components/chat/ChatSuggestions.tsx:3` — hard-coded per weekdag.
- **Jip-en-janneketaal:** Op maandag staat altijd "Wat train ik vandaag?" — ook als je vandaag al getraind hebt. Koppel aan `useSchemaWeek` zodat suggesties veranderen op basis van dag-status.
- **Severity:** P3.
- **Effort:** S.
- **Bron:** Fase 3 (Chat #3).

### E9. `NutritionInput` staat boven dag-samenvatting (omgekeerd patroon)
- **Tech:** `NutritionPage.tsx:104` — input boven `DayIndicator` + `MacroSummary`.
- **Jip-en-janneketaal:** MyFitnessPal/Whoop tonen eerst je dag-stand, dan onderaan het inputveld (dicht bij keyboard). Pulse doet het omgekeerd. Swap.
- **Severity:** P3.
- **Effort:** S.
- **Bron:** Fase 3 (Nutrition #1).

### E10. Geen focus-rings op inputs (keyboard nav onzichtbaar)
- **Tech:** `outline-none` op alle inputs in signup, login, ChatInput, OnboardingWizard; geen `focus-visible:ring-*`.
- **Jip-en-janneketaal:** Wanneer je met Tab door een formulier navigeert (toetsenbord), zie je niet waar je bent. WCAG-overtreding én slecht voor jou als je ooit met een Bluetooth-keyboard op je iPad werkt.
- **Severity:** P3.
- **Effort:** S.
- **Bron:** Fase 3 (cross-cutting #4).

### E11. Bottom-nav gebruikt deprecated `dark:` class die niet werkt
- **Tech:** `Navigation.tsx:46` heeft `bg-white/72 dark:bg-[#1C1C1E]/72` maar `<html>` heeft geen `.dark` class.
- **Jip-en-janneketaal:** De tab bar onderaan is altijd licht (wit) in een donkere app. Verwijder de `dark:` variant en gebruik direct `bg-[#1C1C1E]/72`.
- **Severity:** P2.
- **Effort:** XS.
- **Bron:** Fase 3 (cross-cutting #6).

### E12. `motion-presets.listContainer` mist `initial` variant
- **Tech:** `src/lib/motion-presets.ts:51`.
- **Jip-en-janneketaal:** Stille fragiliteit: werkt nu alleen omdat de kinderen toevallig de juiste variant gebruiken. Voeg een lege `initial: {}` toe als safety net.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 3 (cross-cutting #5).

### E13. Dode code in `CheckInFlow.tsx`
- **Tech:** `CheckInFlow.tsx:181` — `data.previousReview === null && confirmed` check zonder render.
- **Jip-en-janneketaal:** Overgebleven puin van een eerdere versie. Verwijder.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 3 (Check-in #3).

---

## F. PERFORMANCE (alleen relevant waar 't ook voor jou zichtbaar is)

### F1. `googleapis` zonder `import 'server-only'` guard
- **Tech:** `src/lib/google/calendar.ts:1`, `oauth.ts:2`. De `googleapis` library is 194 MB (server-side fijn, maar als 't ooit per ongeluk in een client component belandt, +500-800 KB in je browser-bundle).
- **Jip-en-janneketaal:** Twee regels code voorkomen dat je per ongeluk een gigantische library naar je phone-browser stuurt. Goedkope verzekering.
- **Severity:** P1.
- **Effort:** XS.
- **Bron:** Fase 5 (sectie 1.1).

### F2. Recharts geladen zelfs als je niet naar /progress gaat
- **Tech:** `src/components/progress/{Volume,Strength,Running}Chart.tsx` worden niet via `next/dynamic` geladen.
- **Jip-en-janneketaal:** Recharts (~200 KB gzipped) is in je homepage-bundle. Met dynamic imports laadt 't pas op /progress. Schelt ~150ms TTI op de homepage.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 5 (sectie 1.2).

### F3. Ontbrekende indexen op `workout_exercises` en `personal_records`
- **Tech:** Geen index op `workout_exercises(exercise_definition_id)` (gebruikt in JOINs) of `personal_records(workout_id)` (gebruikt in workout-detail). Geen GIN trigram op `workouts.title` voor ilike-search.
- **Jip-en-janneketaal:** Database-zoekopdrachten zonder index = traag bij groeiende data. Voor jou met ~200 workouts nog niet merkbaar; na 1-2 jaar wel. Migration toevoegen is 5 minuten.
- **Severity:** P2.
- **Effort:** XS (SQL is al klaar in Fase 5).
- **Bron:** Fase 5 (sectie 3).

### F4. `/api/workouts/[id]` doet 3 sequentiële queries (kan parallel)
- **Tech:** `src/app/api/workouts/[id]/route.ts:95-149` — query 2 (PRs) en query 3 (vorige workout) staan na elkaar, kunnen via `Promise.all`.
- **Jip-en-janneketaal:** Workout-detail pagina is ~50-100 ms sneller te maken zonder gedragsverandering. Eén regel `Promise.all`.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 5 (sectie 2.2).

### F5. `useSchema` poll elke minuut op statische data
- **Tech:** `src/hooks/useSchema.ts` heeft `refreshInterval: 60_000`.
- **Jip-en-janneketaal:** Je schema verandert zelden (alleen na een check-in of handmatige edit). Elke minuut DB-bevragen is verspilling. Zet op `0` + `revalidateOnFocus: false`. Spaart batterij/data op mobiel.
- **Severity:** P2.
- **Effort:** XS.
- **Bron:** Fase 5 (sectie 4.2).

### F6. `useExerciseList` / `useBodyComposition` / `useCoachingMemory` doen onnodige revalidations
- **Tech:** Alle drie missen `revalidateOnFocus: false`.
- **Jip-en-janneketaal:** Elke keer als je terug-tabt naar Pulse haalt 'ie deze data opnieuw op, hoewel die zelden verandert. Voeg de optie toe.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 5 (sectie 4.2).

### F7. `/api/chat` draait op Node ipv Edge
- **Tech:** Geen `export const runtime = 'edge'` op de chat-route. Eerst checken of `checkRateLimit` Edge-compatible is.
- **Jip-en-janneketaal:** Chat-streaming kan ~50-150 ms eerder beginnen op Edge runtime. Voor jou alleen waarschijnlijk net niet merkbaar (single-user, geen cold starts), maar gratis.
- **Severity:** P3.
- **Effort:** S (mits rate-limiter wordt geüpgrade naar bv. Upstash).
- **Bron:** Fase 5 (sectie 5).

### F8. `select('*')` op brede aggregatietabellen
- **Tech:** `src/app/api/dashboard/route.ts:57-74` doet `select('*')` op `weekly_aggregations`, `daily_aggregations`, `training_schemas`.
- **Jip-en-janneketaal:** Haalt elke kolom op, ook degene die je niet gebruikt. Kleine snelheidsverbetering. Goede-hygiëne-fix.
- **Severity:** P3.
- **Effort:** S.
- **Bron:** Fase 5 (sectie 2.5).

### F9. `ExerciseImage` gebruikt `unoptimized` (geen Next image optimization)
- **Tech:** `src/components/shared/ExerciseImage.tsx:31`.
- **Jip-en-janneketaal:** Hevy-images worden zonder optimalisatie geladen. Voor kleine icons (28-36px) prima; voor grotere images (200x200) verspilt het bandbreedte. Whitelist het Hevy-domein in `next.config.ts` en haal `unoptimized` weg.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 5 (sectie 7).

### F10. Dashboard heeft geen fallback bij cron-failure
- **Tech:** `/api/dashboard` leest alleen uit `daily_aggregations`. Als de cron niet draait, blijft de dag leeg.
- **Jip-en-janneketaal:** Als de Vercel cron op 02:00 UTC ergens een glitch heeft (netwerk, restart), zie je vandaag geen data op je homepage. Voeg inline-fallback toe: als data ontbreekt voor vandaag → `computeDailyAggregation(userId, today)` aanroepen.
- **Severity:** P2.
- **Effort:** S.
- **Bron:** Fase 5 (sectie 6.3).

---

## G. PRODUCTIE-STABILITEIT (single-user-versie)

### G1. Geen error tracking (Sentry)
- **Tech:** Geen `@sentry/nextjs` in `package.json`; geen `src/instrumentation.ts`. 111 `console.log/error` in `src/`.
- **Jip-en-janneketaal:** Als de app crasht (op je iPhone, in een Vercel-functie), weet je 't niet. Je zou 't pas zien als jij toevallig een knop klikt en niks gebeurt. Sentry geeft je notificaties + stack traces. Free tier is meer dan genoeg voor jou alleen.
- **Severity:** P1.
- **Effort:** S (1 uur — `pnpm add @sentry/nextjs && npx @sentry/wizard@latest -i nextjs`).
- **Bron:** Fase 6 (sectie 6).

### G2. Geen structured logging (alleen `console.log`)
- **Tech:** 111 console-calls in `src/`. Geen log-niveaus, geen request-correlatie.
- **Jip-en-janneketaal:** Vercel-logs zijn één grote bende strings. Bij debuggen moet je grep'en. Niet kritiek voor jou; nice-to-have als je iets eens specifieks wilt onderzoeken.
- **Severity:** P3.
- **Effort:** M.
- **Bron:** Fase 6 (sectie 6).

### G3. Supabase PITR (point-in-time recovery) niet beschikbaar op Free tier
- **Tech:** Free tier = 1 dag daily backup. Pro tier ($25/mo) = 7 dagen PITR + daily.
- **Jip-en-janneketaal:** Als jij vanavond per ongeluk `DELETE FROM workouts` doet in de Supabase studio (of een migratie loopt fout), kun je nu maximaal 24 uur terug. Met PITR: tot op de minuut. Voor jouw eigen jaren-aan-data is dit waardevol. Pro tier is sowieso aan te raden gezien:
  - PITR (data-veiligheid)
  - 8GB DB ipv 500MB (groeit naar volle DB binnen 2-3 jaar bij jouw gebruik)
  - Geen "paused na 1 week inactiviteit" risico
- **Severity:** P1.
- **Effort:** XS ($25/mo upgrade).
- **Bron:** Fase 6 (sectie 7).

### G4. Geen `on_auth_user_created` trigger voor `user_settings`
- **Tech:** Geen DB-trigger die bij signup automatisch een `user_settings` rij aanmaakt.
- **Jip-en-janneketaal:** Niet relevant voor jou (jouw user_settings staat al), behalve als je ooit lokaal een testaccount maakt (jouw `stef@pulse.test`). Dan crasht het eerste request omdat `.single()` op user_settings faalt. Trigger toevoegen is 5 regels SQL.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 6 (sectie 3).

### G5. `HEVY_API_KEY` env-fallback in sync-code
- **Tech:** `src/lib/hevy/sync.ts` doet `process.env.HEVY_API_KEY ?? user_settings.hevy_api_key`.
- **Jip-en-janneketaal:** Bij jou werkt dit prima omdat alleen jij users bent. Wel: dit betekent dat als jouw `.env.local` (of Vercel env) ooit een Hevy-key bevat van iemand anders, alle sync-calls die key gebruiken. Defensieve fix: gewoon weghalen, gebruik altijd `user_settings`.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 6 (sectie 2).

### G6. Geen rate-limit cap op AI check-in endpoints
- **Tech:** `/api/check-in/analyze`, `/api/check-in/plan`, `/api/check-in/review` hebben geen `checkRateLimit()`.
- **Jip-en-janneketaal:** Voor jou alleen relatief klein risico — maar bij een bug die per ongeluk in een loop terechtkomt (bv. een retry zonder backoff in CheckInFlow), kan je per ongeluk 100 keer dezelfde Claude-call doen voordat je 't merkt. Een cap van bv. 30 calls/min beschermt je portemonnee tegen jezelf.
- **Severity:** P3.
- **Effort:** XS.
- **Bron:** Fase 4 (SEC-14), Fase 6.

### G7. `googleapis` zit nog in dependencies maar wordt mogelijk niet gebruikt
- **Tech:** 194 MB lib in node_modules; gebruikt door `src/lib/google/calendar.ts`.
- **Jip-en-janneketaal:** Voor de check-in calendar-write. Als je die feature daadwerkelijk gebruikt (Google Calendar koppeling), houd 'm. Anders weghalen scheelt 194 MB install-grootte. Verifieer eerst dat de calendar-write echt actief is.
- **Severity:** P3 (eerste verifiëren of je 't gebruikt).
- **Effort:** XS (verwijderen) of XS (server-only guard toevoegen).
- **Bron:** Fase 5 (sectie 1.1), Fase 5 open-vragen #3.

---

## H. WAT IK BEWUST UIT DE AUDIT HEB GEFILTERD (single-user-scope)

Dit zijn dingen die de subagents wel noemden, maar voor jou alleen niet relevant zijn (of pas later als je 'm voor anderen openzet):

- **Stripe / billing / pricing tiers** — geen betalende klanten = geen Stripe.
- **Onboarding wizard voor nieuwe users** — jij zit al aan boord.
- **Custom SMTP voor email-verification + welcome-mails** — je mailt geen users.
- **Password-reset flow** — relevant alleen als je 'm regelmatig vergeet. Zie hieronder.
- **Per-user rate-limiting op AI** — voor 100 users belangrijk, voor jou alleen vervangen door G6 (defensieve cap).
- **GDPR-export + delete endpoints** — je bent zelf de data-subject; je kunt rechtstreeks de DB benaderen.
- **Privacy policy / ToS / medische disclaimer** — geen externe gebruikers, geen wettelijke plicht.
- **DPA's met Anthropic/Vercel/Supabase** — niet vereist als enige user.
- **Sub-processor disclosure** — idem.
- **Android-strategie (Google Fit / Health Connect)** — alleen relevant als anderen het moeten kunnen.
- **Cron fan-out / sequential sync** — bij 1 user maakt sequentieel niets uit.
- **Weekly digest email** — je opent de app zelf.
- **Helpdesk / FAQ / status page** — niemand om te helpen.
- **DPIA (Data Protection Impact Assessment)** — alleen verplicht bij externe gezondheidsdata-verwerking.

**Wat ik wél heb gehouden uit deze categorie** maar in B/G heb ondergebracht:
- **Sentry** (G1): nuttig om te weten wanneer je app crasht — ook voor één user.
- **PITR / Supabase Pro** (G3): jouw eigen data veilig houden.
- **`HEVY_API_KEY` env-fallback verwijderen** (G5): defensieve hygiëne.
- **Rate-limiting op AI-routes** (G6): bescherming tegen eigen bugs, niet tegen vreemden.

---

## I. PR-DIFFS DIE AL KLAAR STAAN

| Diff | Wat het is | Effort om te mergen |
|---|---|---|
| `prs/001-fix-checkin-week-calculation.diff` | Check-in plant volgende week ipv huidige (C1) | M — vereist test draaien |
| `prs/002-add-ai-eval-harness.diff` | AI eval-harness met 30 testcases (B1) | S — installeren + run |
| `prs/003-sanitize-chat-markdown-xss.diff` | XSS-sanitize in chat-output (A1) | XS — pnpm add + test |

---

## J. PRIORITERINGSTABEL (vul vinkjes / nummer in)

### Veiligheid (security)
| ID | Titel | Severity | Effort | Doen? |
|---|---|---|---|---|
| A1 | XSS sanitize in chat | P0 | XS | ☐ |
| A2 | `/api/admin/seed-memory` auth | P0 | XS | ☐ |
| A3 | Next.js update (6 HIGH CVE's) | P0 | XS | ☐ |
| A4 | API-keys encrypted opslaan | P1 | M | ☐ |
| A5 | Service-role overal → SSR client | P2 | L | ☐ |
| A6 | RLS-policies verifiëren | P2 | XS | ☐ |
| A7 | Hevy webhook timing-safe-equal | P3 | XS | ☐ |
| A8 | PHI uit Apple Health logs | P0 | XS | ☐ |
| A9 | `debug` object uit response | P3 | XS | ☐ |
| A10 | `OAUTH_STATE_SECRET` losse env | P2 | XS | ☐ |
| A11 | Write-back validatie strenger | P1 | M | ☐ |

### AI-laag
| ID | Titel | Severity | Effort | Doen? |
|---|---|---|---|---|
| B1 | Eval-harness | P1 | M | ☐ |
| B2 | Classifier edge cases fixen | P1 | S–M | ☐ |
| B3 | XML-write → echte tools | P1 | M | ☐ |
| B4 | Dode code uit context-assembler | P2 | S | ☐ |
| B5 | `loadCoachingMemory` limit | P1 | XS | ☐ |
| B6 | Eén weekly-review prompt kiezen | P2 | S | ☐ |
| B7 | Ontbrekende read-tools toevoegen | P1 | M | ☐ |
| B8 | Conversation history samenvatten | P2 | S | ☐ |
| B9 | `result.usage` in try/catch | P2 | XS | ☐ |
| B10 | Memory-extractor telemetrie | P3 | XS | ☐ |
| B11 | Profiel uit prompt, naar tool | P2 | M | ☐ |
| B12 | Response-length policy | P2 | XS | ☐ |

### Check-in bug
| ID | Titel | Severity | Effort | Doen? |
|---|---|---|---|---|
| C1 | Plan volgende week (niet huidige) | P0 | M | ☐ |

### Code-kwaliteit
| ID | Titel | Severity | Effort | Doen? |
|---|---|---|---|---|
| D1 | `formatDate` etc. centraliseren | P1 | S | ☐ |
| D2 | `getISOWeekNumber` centraliseren | P1 | S | ☐ |
| D3 | `as unknown as` → Zod (16 plekken) | P2 | L | ☐ |
| D4 | Stille `catch {}` blokken loggen | P1 | XS | ☐ |
| D5 | `useEffect` voor props→state | P2 | S | ☐ |
| D6 | `key={index}` fixen | P2 | S | ☐ |
| D7 | `SchemaPageContent` dubbel-fetch | P2 | M | ☐ |
| D8 | `CoachAnalysisCard` → SWR | P2 | S | ☐ |
| D9 | Types uit `route.ts` halen | P2 | S | ☐ |
| D10 | Sport-types in `constants.ts` | P3 | S | ☐ |
| D11 | `src/proxy.ts` verwijderen | P3 | XS | ☐ |
| D12 | `bodyMapData.ts` verplaatsen | P3 | XS | ☐ |
| D13 | `hevyFetch<T>` generic weg | P3 | XS | ☐ |
| D14 | Onnodige `"use client"` (~18 bestanden) | P3 | M | ☐ |
| D15 | ProgressPage auto-select inline | P3 | XS | ☐ |
| D16 | Settings save error UX | P3 | S | ☐ |

### UI/UX
| ID | Titel | Severity | Effort | Doen? |
|---|---|---|---|---|
| E1 | Empty states op homecards | P1 | M | ☐ |
| E2 | `ReadinessSignal` skeleton | P1 | XS | ☐ |
| E3 | `themeColor` corrigeren | P2 | XS | ☐ |
| E4 | Dubbele `pb-24` verwijderen | P2 | XS | ☐ |
| E5 | Tap targets ≥44px | P2 | S | ☐ |
| E6 | Design tokens v2 migratie | P2 | L | ☐ |
| E7 | `CoachOrb` component bouwen | P2 | S | ☐ |
| E8 | ChatSuggestions context-gevoelig | P3 | S | ☐ |
| E9 | NutritionInput verplaatsen | P3 | S | ☐ |
| E10 | Focus-rings op inputs | P3 | S | ☐ |
| E11 | Bottom-nav dark-class fixen | P2 | XS | ☐ |
| E12 | `motion-presets` initial-variant | P3 | XS | ☐ |
| E13 | Dode code in CheckInFlow | P3 | XS | ☐ |

### Performance
| ID | Titel | Severity | Effort | Doen? |
|---|---|---|---|---|
| F1 | `import 'server-only'` op googleapis | P1 | XS | ☐ |
| F2 | Recharts dynamic import | P2 | S | ☐ |
| F3 | Ontbrekende indexen toevoegen | P2 | XS | ☐ |
| F4 | Workout-detail queries parallel | P3 | XS | ☐ |
| F5 | `useSchema` refresh interval 0 | P2 | XS | ☐ |
| F6 | SWR `revalidateOnFocus: false` | P3 | XS | ☐ |
| F7 | `/api/chat` op Edge | P3 | S | ☐ |
| F8 | `select('*')` → specifieke kolommen | P3 | S | ☐ |
| F9 | `ExerciseImage` optimization | P3 | XS | ☐ |
| F10 | Dashboard cron-fallback | P2 | S | ☐ |

### Productie-stabiliteit
| ID | Titel | Severity | Effort | Doen? |
|---|---|---|---|---|
| G1 | Sentry toevoegen | P1 | S | ☐ |
| G2 | Structured logging | P3 | M | ☐ |
| G3 | Supabase Pro (PITR) | P1 | XS | ☐ |
| G4 | `on_auth_user_created` trigger | P3 | XS | ☐ |
| G5 | `HEVY_API_KEY` env-fallback weg | P3 | XS | ☐ |
| G6 | Rate-limit cap op AI-check-in | P3 | XS | ☐ |
| G7 | `googleapis` keep/remove beslissen | P3 | XS | ☐ |

---

## K. SUGGESTIE: AANVALSVOLGORDE (mijn advies)

**Vandaag (1-2 uur):**
1. A1 — XSS sanitize (`prs/003`)
2. A2 — admin endpoint auth
3. A3 — Next.js update
4. A8 — PHI uit logs
5. C1 — check-in week-fix (`prs/001`)

**Deze week (4-6 uur):**
6. G1 — Sentry installeren
7. G3 — Supabase Pro upgrade
8. F1 — `server-only` guards
9. F3 — DB-indexen
10. F5 — `useSchema` refresh
11. E2 + E3 + E4 — UI quick wins
12. A6 — RLS verificatie
13. A10 — `OAUTH_STATE_SECRET`

**Deze maand (focus AI):**
14. B1 — eval-harness installeren (`prs/002`)
15. B5 — coaching memory limit
16. B2 — classifier edge cases fixen + tests
17. B3 — XML-writes → tools
18. B7 — ontbrekende read-tools
19. B4 — dode context-assembler code weg
20. D4 — stille catch-blokken loggen
21. A4 — API-keys encrypted
22. A11 — write-back validatie strenger

**Wanneer 't uitkomt:**
- Alle P2's uit code-kwaliteit + UI/UX (incrementeel)
- Design tokens v2 (E6, L-effort, incrementeel)
- `as unknown as` cleanup (D3, L-effort)

**Nice to have / kan rustig wachten:**
- Alle P3's

---

## L. OPEN VRAGEN VOOR JOU

1. **Google Calendar koppeling — gebruik je 't?** Dit bepaalt G7 (googleapis dependency houden of weg) en hoe belangrijk de check-in calendar-write (C1) is.
2. **Supabase Pro upgrade — akkoord?** $25/mo voor PITR + 8GB DB + altijd-aan. Mijn advies: ja, voor data-veiligheid van je eigen jaren-data.
3. **Wil je dat ik per categorie (A/B/C/...) PR's ga maken**, of wil je dat ik 1 voor 1 een fix uitvoer en review-en?
4. **A4 (API-keys encrypted):** prefereer je Supabase Vault (vereist Pro tier — sluit aan op G3) of app-level encryption met een key in `.env`?
5. **B11 (profiel uit prompt naar tool):** vind je 't OK dat ik de hardcoded persoonlijke data uit `chat-system.ts` weghaal en vervang door tool-calls naar de DB?
6. **D14 (`"use client"` opruimen):** wil je een grote refactor of incrementeel per component?
7. **Welke prioriteit-cap?** Wil je dat ik alleen P0+P1 doe, of ook P2's tegelijk meenemen?
