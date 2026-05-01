# Backlog: Check-in v2 — Continuïteit, Geheugen, Guardrails

**Datum:** 1 mei 2026
**Bron:** code-audit + research-rapport (Whoop / MacroFactor / Future / Oura / GROW / Tiny Habits / ACWR / Memoria/PH-LLM)
**Status:** Backlog — story-by-story op te pakken, deels parallel uitvoerbaar

---

## Hoe deze backlog te lezen

- **ID** = `CHECKIN-XX` — uniek, refereerbaar in branches/PR's (`feature/CHECKIN-04-wellness-block`)
- **Omvang** = XS (≤1u) · S (1-3u) · M (3-8u) · L (1-2 dagen) · XL (>2 dagen)
- **Fase** = wanneer in de roadmap (1 = continuïteit, 2 = signaal, 3 = ops/polish)
- **Parallel-veilig** = ✅ kan gelijktijdig met andere ✅ stories door een aparte agent worden gedaan zonder file-conflicten. ⚠️ = moet seriëel.
- **Acceptatiecriteria** = checklist die "klaar" definieert
- **Dependencies** = welke stories eerst af moeten

Status-veld bij elke story: `📋 todo` · `🚧 in progress` · `🧪 review` · `✅ done` · `⏸️ blocked`

---

## Roadmap (volgorde)

```
Sprint 1 — Quick wins & test-omgeving (~1 dag)
  CHECKIN-01 (XS, ⚠️) Dry-run mode  ← FIRST: blokkeert veilig testen van alle stories hieronder
  CHECKIN-02 (S, ✅) Seed-data helper voor testen

Sprint 2 — Sluit de week-loop (~2-3 dagen, deels parallel)
  CHECKIN-03 (M, ⚠️) Migratie: weekly_reviews + focus-outcome velden
  CHECKIN-04 (S, ✅) Wellness-blok in stap 1 (sliders + open notitie)
  CHECKIN-05 (M, ⚠️) Vorige-week-focus sectie + outcome-capture
  CHECKIN-06 (S, ✅) Coach Analyse prompt herschrijven (named win + risk + cap)
  CHECKIN-07 (XS, ✅) Self-contained-week copy + skip-recovery flow

Sprint 3 — Meer signaal (~4-6 dagen)
  CHECKIN-08 (L, ⚠️) user_profile tabel + migratie van hardcoded blokken
  CHECKIN-09 (M, ⚠️) ACWR berekening + EWMA + guardrail in plan-stap
  CHECKIN-10 (M, ⚠️) Coaching memory met confidence/decay/conflict
  CHECKIN-11 (M, ✅) Slimmere gap-detectie (3 cases + skip-redenen)

Sprint 4 — Ops & polish (~3-4 dagen)
  CHECKIN-12 (M, ⚠️) Confirm splitsen + idempotency + retries
  CHECKIN-13 (S, ✅) Edit-na-confirm
  CHECKIN-14 (M, ✅) Outcome-tracking dashboard op /check-in/history
```

---

## Sprint 1 — Quick wins

### CHECKIN-01 · Dry-run mode voor testen
**Status:** 🧪 review · **Branch:** `feature/CHECKIN-01-dry-run-mode` · **Omvang:** XS · **Fase:** 3 (vooruitgehaald) · **Parallel:** ⚠️ raakt confirm-route + CheckInFlow
**Why:** Stef kan de hele wizard niet end-to-end testen zonder echte writes naar DB + Google Calendar.
**Files:** `src/app/api/check-in/confirm/route.ts`, `src/components/check-in/CheckInFlow.tsx`, `src/components/check-in/ConfirmationCard.tsx`
**Acceptatie:**
- [ ] `ConfirmRequestSchema` heeft optioneel veld `dry_run: boolean` (default false)
- [ ] Bij `dry_run: true`: alle DB-upserts en Calendar-call worden geskipt; endpoint returnt een fake review-object met `id: 'dry-run'`
- [ ] UI: toggle bovenaan `CheckInFlow.tsx` ("🧪 Test mode") met visuele indicator gedurende de hele flow
- [ ] Toggle-state propageert naar `ConfirmationCard` en wordt meegestuurd in de POST
- [ ] Success-scherm laat duidelijk zien "Test mode — niets opgeslagen"

---

### CHECKIN-02 · Seed-data helper voor check-in testing
**Status:** 📋 todo · **Omvang:** S · **Fase:** 3 · **Parallel:** ✅
**Why:** Voor het testen van fase-2 stories (vorige-week-focus, outcome-trends) heb je rijke historische data nodig. Een script dat 8-12 weken back-fills helpt.
**Files:** nieuwe `scripts/seed-checkin-history.ts`
**Acceptatie:**
- [ ] Script maakt 12 weken aan `weekly_reviews` met varieerde wellness/focus/outcome
- [ ] Maakt bijbehorende `coaching_memory` entries
- [ ] Idempotent: 2x runnen = hetzelfde resultaat
- [ ] CLI flag `--user-id` voor target-user

---

## Sprint 2 — Sluit de week-loop

### CHECKIN-03 · Migratie: weekly_reviews uitbreiden
**Status:** ✅ done · **Branch:** `feature/CHECKIN-03-weekly-reviews-v2-fields` · **Omvang:** M · **Fase:** 1 · **Parallel:** ⚠️ blokkeert 04, 05
**Why:** Wellness-data en focus-outcome moeten ergens landen. Kolommen op `weekly_reviews` ipv aparte tabel = simpeler, single-row-per-week past natuurlijk.
**Files:** nieuwe `supabase/migrations/2026XXXX_checkin_v2_fields.sql`, regenerate `src/types/database.ts`
**Acceptatie:**
- [ ] Migratie voegt toe aan `weekly_reviews`:
  - `wellness_energy smallint check (between 1 and 5)`
  - `wellness_motivation smallint check (between 1 and 5)`
  - `wellness_stress smallint check (between 1 and 5)`
  - `notes_text text`
  - `previous_focus_rating text check (in 'gehaald','deels','niet')`
  - `previous_focus_note text`
- [ ] Alle nullable (backfill = null)
- [ ] `pnpm supabase gen types` opnieuw gedraaid en gecommit
- [ ] Migratie idempotent (heeft `if not exists`)

---

### CHECKIN-04 · Wellness-blok in stap 1
**Status:** 🧪 review · **Branch:** `feature/CHECKIN-04-wellness-block` · **Omvang:** S · **Fase:** 1 · **Parallel:** ✅ (na 03)
**Why:** Subjectieve scores zijn vaak vroegere voorspellers dan biomarkers. ≤30 sec werk voor de gebruiker.
**Files:** `src/components/check-in/WeekReviewCard.tsx`, eventueel `src/components/check-in/WellnessBlock.tsx`
**Acceptatie:**
- [ ] Nieuw blok in stap 1 met 3 sliders 1-5: Energie, Motivatie, Stress
- [ ] 1 textarea: "Wat was de grootste win? Wat liep tegen?" — optioneel
- [ ] State propageert naar `CheckInFlow` en wordt meegestuurd in confirm
- [ ] `ConfirmRequestSchema` accepteert de nieuwe velden
- [ ] Visueel consistent met design system (sport-tokens, radius.lg, surface)
- [ ] Mobile-first; sliders zijn met duim bedienbaar

---

### CHECKIN-05 · Vorige-week-focus sectie + outcome-capture
**Status:** 🧪 review · **Branch:** `feature/CHECKIN-05-previous-focus` · **Omvang:** M · **Fase:** 1 · **Parallel:** ⚠️ raakt review-route + WeekReviewCard
**Why:** Hoogste-ROI continuïteits-move. "Last week you said X — here's what happened" sluit de loop die nu open is.
**Files:** `src/app/api/check-in/review/route.ts`, `src/components/check-in/WeekReviewCard.tsx`, `src/lib/ai/prompts/checkin-analyze.ts`
**Acceptatie:**
- [ ] Review-endpoint extract uit `previousReview.next_week_plan.focusNextWeek` → expose als `previousFocus: string | null`
- [ ] UI bovenaan stap 1: "Vorige week: \"{focus}\"" + 3 knoppen `Gehaald / Deels / Niet`
- [ ] Optioneel textveld voor toelichting (1 zin)
- [ ] Outcome wordt opgeslagen in `previous_focus_rating` + `previous_focus_note` op huidige week's review
- [ ] AI-analyse-prompt krijgt outcome-context: "vorige focus: X, beoordeling: Y"
- [ ] Als geen vorige review bestaat: blok niet tonen

---

### CHECKIN-06 · Coach Analyse prompt herschrijven
**Status:** 🧪 review · **Branch:** `feature/CHECKIN-06-analyze-prompt-rewrite` · **Omvang:** S · **Fase:** 1 · **Parallel:** ✅ kan los van 03/04/05
**Why:** Whoop-thread bevestigde: lange AI-summaries verliezen vertrouwen. GROW + Tiny Habits zegt: open met named win.
**Files:** `src/lib/ai/prompts/checkin-analyze.ts`
**Acceptatie:**
- [ ] System prompt eist verplichte structuur:
  1. Eén named win (specifieke oefening/gebeurtenis met cijfers)
  2. Eén named risk of obstacle
  3. 1-3 zinnen pattern (verbinding met vorige weken via memory)
  4. 1 voorgestelde `focus_next_week` (1 zin, max 15 woorden)
- [ ] Hard cap: ~120 woorden voor de hele analyse
- [ ] Geen generieke uitspraken ("je traint consistent") — verbod expliciet in prompt
- [ ] Output blijft schema-compatibel (zelfde JSON shape voor `summary_text` + `key_insights` + `focus_next_week`)
- [ ] Test met 3 echte weken: lengte ≤120w, structuur klopt

---

### CHECKIN-07 · Self-contained week framing
**Status:** 🧪 review · **Branch:** `feature/CHECKIN-07-self-contained-week` · **Omvang:** XS · **Fase:** 1 · **Parallel:** ✅
**Why:** MacroFactor's grote inzicht: streaks creëren all-or-nothing-druk. Pulse mag niet straffen voor gemiste weken.
**Files:** `src/components/home/CheckInBadge.tsx`, `src/components/check-in/CheckInFlow.tsx`, copy in `WeekReviewCard.tsx`
**Acceptatie:**
- [ ] Badge toont alleen huidige week, geen "je hebt N reviews gemist"-tekst
- [ ] Als `previousReview` >2 weken oud is: opening-copy in stap 1 = "Laten we vooruit kijken" (geen guilt-trip)
- [ ] Audit alle bestaande copy: weg met "streak", "X weken op rij", etc.

---

## Sprint 3 — Meer signaal

### CHECKIN-08 · user_profile tabel + migratie hardcoded blokken
**Status:** 📋 todo · **Omvang:** L · **Fase:** 2 · **Parallel:** ⚠️ raakt veel prompts
**Why:** Blessures, gewoontes, voeding-targets, gym-locatie, geleerde lessen zitten verspreid in `chat-system.ts` — ontoegankelijk voor users en niet AI-update-baar.
**Files:** nieuwe migratie, `src/lib/ai/prompts/chat-system.ts`, `src/lib/ai/prompts/checkin-analyze.ts`, `src/lib/ai/prompts/checkin-plan.ts`, nieuwe `src/lib/profile/build-profile-block.ts`
**Acceptatie:**
- [ ] Tabel `user_profile (user_id pk, injuries jsonb, recurring_habits jsonb, nutrition_targets jsonb, gym_location text, training_response jsonb, updated_at)`
- [ ] Seed-script vult Stef's huidige hardcoded data
- [ ] Helper `buildProfileBlock(userId): Promise<string>` die het stuk markdown produceert dat nu hardcoded staat
- [ ] `chat-system.ts` sectie 3, 4, 5, 11 vervangen door dynamische injectie van dit blok
- [ ] Idem voor `checkin-analyze` en `checkin-plan` waar relevant
- [ ] AI mag in check-in een suggestie doen ("zal ik 'schouder' op hersteld zetten?") — UI knop accepteert/wijst af; alleen na expliciete user-confirm wordt `user_profile` ge-update
- [ ] Settings-pagina UI om `user_profile` handmatig te editen (later, kan in CHECKIN-14)

---

### CHECKIN-09 · ACWR guardrail in plan-stap
**Status:** 📋 todo · **Omvang:** M · **Fase:** 2 · **Parallel:** ⚠️ raakt plan-route
**Why:** Met schouder/knie-historie is dit dé objectieve regel. Sport-science consensus: EWMA, banden 0.8-1.3 = optimaal, >1.5 = injury-risk.
**Files:** nieuwe `src/lib/training/acwr.ts`, `src/app/api/check-in/plan/route.ts`, `src/components/check-in/WeekPlanCard.tsx`
**Acceptatie:**
- [ ] `computeACWR(userId, weekStart): { acute, chronic, ratio }` met EWMA (28-dag chronic, 7-dag acute)
- [ ] Plan-route berekent voor het voorgestelde plan de projected ratio
- [ ] Response includeert `loadProjection: { current, projected, ratio, status: 'green'|'amber'|'red' }`
- [ ] UI toont badge bij plan: groen ≤1.3, oranje 1.3-1.5, rood >1.5
- [ ] Bij oranje + rood: waarschuwing met uitleg ("acute load is X% boven chronic baseline — let op herstel"), géén blokkade
- [ ] Optionele knop "Genereer rustiger plan" beschikbaar bij oranje en rood
- [ ] Volume-bron: `workouts.total_volume_kg` + `runs.distance_km × 50` als heuristiek (configureerbaar)

---

### CHECKIN-10 · Coaching memory met decay
**Status:** 📋 todo · **Omvang:** M · **Fase:** 2 · **Parallel:** ⚠️ schema-wijziging
**Why:** Na 6 maanden = bag-of-facts-soep. Memoria/PH-LLM patroon: confidence + supersession.
**Files:** migratie, `src/lib/ai/memory-extractor.ts`, prompt-builders
**Acceptatie:**
- [ ] Migratie voegt toe aan `coaching_memory`:
  - `confidence float default 1.0`
  - `last_confirmed_at timestamptz default now()`
  - `superseded_by uuid references coaching_memory(id)`
- [ ] Bij elke check-in: facts ouder dan 6 weken zonder bevestiging krijgen `confidence -= 0.2`
- [ ] Filter in prompt-builder: alleen entries met `confidence > 0.3` AND `superseded_by is null`
- [ ] AI mag bij analyse aangeven welke memory-entries achterhaald lijken — UI biedt "markeer achterhaald" knop
- [ ] Conflict-detectie: nieuwe insight die tegenstrijdig is met bestaande → automatisch `superseded_by` aanvullen

---

### CHECKIN-11 · Slimmere gap-detectie
**Status:** 📋 todo · **Omvang:** M · **Fase:** 2 · **Parallel:** ✅ (na 03)
**Why:** Huidige logica matcht alleen op datum, niet op type. "Vergeten loggen" en "bewust geskipt" zijn fundamenteel verschillende signalen.
**Files:** `src/app/api/check-in/review/route.ts`, `src/components/check-in/WeekReviewCard.tsx`, nieuwe migratie voor `skip_reasons`
**Acceptatie:**
- [ ] Gap-detectie classificeert per dag in 3 cases:
  1. **Geen activiteit op die datum** → "Vergeten te loggen?"
  2. **Andere training dan gepland** → "Plan was X, je deed Y — bewust?"
  3. **Bewuste skip** (na user-input) → opgeslagen in `skip_reasons`
- [ ] UI per gap: 3 knoppen `Vergeten / Bewust geskipt / Was iets anders`
- [ ] Bij "Vergeten": inline 1-tap log-modal (gym/run/padel + duur)
- [ ] Bij "Bewust geskipt": dropdown reden (ziek/druk/rust/anders) → `skip_reasons (user_id, date, reason, note)`
- [ ] Bij "Was iets anders": dropdown welke training type → update `scheduled_overrides`
- [ ] Skip-redenen aggregeren in coaching memory voor patroon-analyse

---

## Sprint 4 — Ops & polish

### CHECKIN-12 · Confirm splitsen + idempotency
**Status:** 📋 todo · **Omvang:** M · **Fase:** 3 · **Parallel:** ⚠️ raakt veel
**Why:** Nu zit er 1 sync write + 4 fire-and-forget in één endpoint. Als calendar of overrides faalt, weet niemand het.
**Files:** splits `confirm/route.ts`, refactor `ConfirmationCard.tsx`
**Acceptatie:**
- [ ] 3 endpoints: `POST /api/check-in/confirm/review`, `/confirm/calendar`, `/confirm/overrides`
- [ ] UI roept ze sequentieel aan met progress-stepper
- [ ] Failure in calendar = blocking error met retry-knop, niet stille console.error
- [ ] Elke endpoint accepteert `idempotency_key` header zodat retry geen duplicaten geeft
- [ ] Telemetry: success/failure per stap loggen (later naar Sentry te koppelen)

---

### CHECKIN-13 · Edit-na-confirm
**Status:** 📋 todo · **Omvang:** S · **Fase:** 3 · **Parallel:** ✅
**Why:** Typefout? Verkeerde focus opgeschreven? Nu alleen via SQL.
**Files:** nieuwe `src/app/check-in/[id]/edit/page.tsx`, hergebruikt CheckInFlow
**Acceptatie:**
- [ ] Route `/check-in/[id]/edit` opent CheckInFlow geprefilled met bestaande review-data
- [ ] Confirm doet UPDATE i.p.v. INSERT
- [ ] Vanuit history-page een "bewerken" knop per review
- [ ] Optioneel later: `weekly_reviews_revisions` tabel voor versie-historie

---

### CHECKIN-14 · Outcome-tracking dashboard
**Status:** 📋 todo · **Omvang:** M · **Fase:** 3 · **Parallel:** ✅
**Why:** Bewijs leveren dat de check-in wat oplevert + zelfreflectie ondersteunen.
**Files:** nieuwe `src/components/check-in/HistoryAnalytics.tsx`, update `CheckInHistoryPage.tsx`
**Acceptatie:**
- [ ] Sectie bovenaan history-page met 3 charts (Recharts):
  1. Focus-outcome trend laatste 12 weken (stacked bar gehaald/deels/niet)
  2. Wellness-trend (lijngrafiek energie/motivatie/stress)
  3. ACWR over tijd (lijn met 0.8/1.3/1.5 banden)
- [ ] Lege-state als <3 weken data
- [ ] Mobile-responsive

---

## Parallel-veiligheid matrix

Stories die ✅ zijn kunnen tegelijk door verschillende agents worden gedaan. Hieronder welke combinaties veilig zijn (geen file-conflicten):

| Combinatie | Veilig? | Waarom / waar te letten |
|---|---|---|
| 02 + 06 + 07 | ✅ | Compleet andere bestanden |
| 04 + 11 (na 03) | ⚠️ | Beide raken `WeekReviewCard.tsx` — coördineer of doe sequentieel |
| 06 + 09 | ✅ | Verschillende prompts/routes |
| 13 + 14 | ✅ | Edit-flow vs history-page analytics |
| 08 + iets anders | ❌ | Raakt prompts breed; doe dit standalone |

---

## Definition of Done (per story)

Elke story is pas `✅ done` als:
1. Acceptatiecriteria afgevinkt
2. `pnpm tsc --noEmit` schoon
3. Manueel getest in browser (gebruik CHECKIN-01 dry-run om productie-data niet te raken)
4. Conventional commit op branch `feature/CHECKIN-XX-korte-beschrijving`
5. Stef heeft het gereviewed

---

## Beslissingen (vastgelegd 1 mei 2026)

| # | Beslissing | Keuze |
|---|---|---|
| D1 | Wellness sliders | **1-5** |
| D2 | `focus_outcome` opslag | **Kolom op `weekly_reviews`** |
| D3 | ACWR red gedrag | **Alleen waarschuwing**, geen blokkade |
| D4 | `user_profile` migratie | **Atomair in CHECKIN-08** |
| D5 | Confirm-splits | **Nu** (in sprint 4) |

Gevolg voor stories:
- CHECKIN-09 acceptatie aangepast: rood toont waarschuwings-badge + uitleg, "rustiger plan" knop wordt optioneel ipv verplicht
- Geen wijziging in 03/04/05/08/12 — defaults waren al de keuzes
