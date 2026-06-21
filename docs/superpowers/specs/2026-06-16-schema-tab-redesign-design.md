# Schema-tab herontwerp — Design

- **Datum:** 2026-06-16
- **Branch:** `worktree-schema-tab-redesign` (worktree, basis `main`)
- **Status:** Goedgekeurd ontwerp — klaar voor implementatieplan

## 1. Probleem

De Schema-tab voelt "random" omdat hij dezelfde twee feiten — *waar zit ik in het blok* en
*wat is deze week* — drie keer toont in drie visuele talen, terwijl de enige interactieve
versie (de kalender) onderaan begraven ligt.

Concrete redundantie in de huidige stack (6 kaarten):

| Feit | Komt voor in |
|------|--------------|
| Blok-titel | `SchemaBlockHeader`, `SchemaProgress`, `SchemaOverview` (3×) |
| Week-van-blok | header, `SchemaProgress`, `SchemaCalendar` (3×) |
| Sessie-teller | header, `SchemaProgress` (2×), `SchemaCalendar` (3×) |
| Week-navigatie | `SchemaProgress` W-segmenten (níét klikbaar), `SchemaCalendar` chevrons, `SchemaCalendar` dots (3×, waarvan 1 dood) |

Daarbovenop drie losse problemen die Stef benoemde:

1. **"Net gestart"-banner verloopt nooit.** Hangt aan `source_block_review_id`, die het hele
   blok lang gezet blijft. Weken later staat er nog steeds "Net gestart".
2. **Het week-blok (`SchemaProgress`) is bijna een kopie van de kop**, en het
   voortgangsmetertje (per-week `voltooid/gepland` fill) is ongelabeld en onbegrijpelijk.
   De W-segmenten zijn niet klikbaar terwijl de kalender eronder wél klikbare week-navigatie
   heeft.
3. **Afwijken van de planning wordt niet opgepakt.** Een op dinsdag gelogde "Upper A" die op
   maandag gepland stond, blijft op maandag staan én verschijnt los op dinsdag (dubbel).

### Onderliggende oorzaken

- **Twee progress-balken met verschillende betekenis.** De header-balk is *tijd*
  (`(week-1)/weken` → altijd 25% in week 2, ook met 0 sessies). `SchemaProgress` is *werk
  gedaan*. Beide ongelabeld.
- **Exacte-titel-matching.** `/api/schema` koppelt een gym-workout alleen aan een geplande
  sessie als de titel exact gelijk is (`workout.title === focus`). Hevy-titels wijken bijna
  altijd af van de beschrijvende schema-namen (bv. focus `"Lower B — Hinge Dominant"` vs Hevy
  `"Lower B"`). Daardoor faalt zowel de exacte-dag-pass als de any-day-in-week-pass, blijft de
  geplande sessie hangen en verschijnt de actual als losse `unplanned` chip.
- **Twee verschillende matchers.** De Schema-tab (`/api/schema`, 2-pass exacte-titel) en de
  Home-weekstrip (`/api/schema/week`, token-model met `done-as-planned`/`done-swap`/
  `done-extra`) handelen afwijking verschillend af → Home en Schema lopen soms niet gelijk.

## 2. Doelen / niet-doelen

**Doelen**

- Schema-tab van 6 kaarten naar ~3 oppervlakken met één bron van waarheid per feit.
- Eén eerlijke, gelabelde progress-indicator.
- De gewaardeerde W1–W4-blokjes blijven, maar wórden de klikbare week-kiezer.
- Afwijken-van-planning klopt (op gelijke, gecanonicaliseerde titel).
- "Net gestart" tijdgebonden + wegklikbaar.
- Eén gedeelde plan-vs-werkelijkheid-reconciliatie, zodat Home en Schema gelijk lopen.
- Consistente kaart-styling (design-tokens v2).

**Niet-doelen (buiten scope)**

- De block-review-flow zelf (`/block-review`, `/api/block-review/*`).
- De Coach-chat en context-assembler.
- De interne werking van de Google Calendar-push (knop blijft, gedrag ongewijzigd).
- De oefening-edit-UX zelf (verhuist alleen van plek; functioneel ongewijzigd).
- Multi-user / RLS-wijzigingen.

## 3. Beslissingen (uit overleg met Stef)

1. **Volledig herontwerp** (niet alleen de 3 punten, niet alleen oppoetsen).
2. **Matching alleen op gelijke titel** — geen sport-fallback. Om de bug daadwerkelijk te
   fixen worden titels vóór vergelijken **gecanonicaliseerd** (zie §6). Dat maakt "Lower B" =
   "Lower B", maar vangt geen synoniemen ("Lower Body B"); die benoemt Stef zelf gelijk.
3. **"Net gestart" tijdgebonden + wegklikbaar** — alleen de eerste 72 uur na aanmaken, en
   permanent wegklikbaar (onthouden per schema).

## 4. Doel-ontwerp (UI)

```
HEADER (pagina-kop, geen kaart)
  Schema · Week 24
  Upper/Lower Blok
  Week 2 van 4 · nog 14 dagen
  ▓▓▓▓▓░░░░░░   ← ÉÉN balk = blok-positie (week 2/4), gelabeld

(alleen eerste 72u, wegklikbaar:)
  ⚠ Net gestart — niet wat je bedoelde?  [Ongedaan maken]  [✕]

KAART 1 · "Deze weken"   (= oude SchemaProgress + SchemaCalendar samengevoegd)
  [W1 ✓][W2 •][W3  ][W4  ]   ← KLIKBAAR = week-kiezer
       elk blokje: weeknr + dunne fill = sessies díé week
       tik W3 → grid eronder springt naar week 3
  ───────────────────────────────────────────────
  Week 2 (huidige) · 18–24 jun · 3/8 sessies        [Aanpassen]
  Ma  Di  Wo  Do  Vr  Za  Zo
  ✓   •   —   ▢   —   —   —     ← plan vs werkelijkheid
       (Upper A verschijnt op Di met "↩ Ma" als je 'm daar deed)
  [📅 Week 2 inplannen in agenda]   (alleen als agenda gekoppeld)

KAART 2 · "Mijn Schema"   (= oude SchemaOverview, standaard ingeklapt)
  Upper/Lower · 6 workouts                                ▾
       uitklap → oefeningen + [Bewerken] [Wijzig via Coach]

· CoachOrb  "Plan blok 3 via de Coach"  ›    (slanke regel, geen kaart)
```

### Header

- Context-regel `Schema · Week <ISO>`, blok-titel, `Week N van M · nog X dagen`.
- **Eén** balk = blok-positie (weken). Expliciet de enige progress-balk; geen tweede
  sessie-balk meer in de kop.

### Kaart 1 — "Deze weken"

Samenvoeging van `SchemaProgress` en `SchemaCalendar`.

- **Week-kiezer** bovenin = de W1–Wn-blokjes, nu klikbaar. Elk blokje toont weeknummer en een
  dunne fill = `sessies voltooid / gepland` díé week. Huidige week gemarkeerd. Tik → het grid
  eronder springt naar die week. Dit **vervangt** de chevrons én de dots (één navigator i.p.v.
  drie).
- **7-dagen-grid** (Ma–Zo) met plan-vs-werkelijkheid-chips. Vandaag gemarkeerd. Een verschoven
  sessie toont op de dag dat je 'm deed, met herkomst-label `↩ <geplande dag>`.
- **Acties:** `[Aanpassen]` (week-dag-indeling, `EditWeekModal`), het per-dag verplaats-menu
  (beter zichtbaar dan het huidige `…`), en `[Week N inplannen in agenda]` als de agenda
  gekoppeld is.

### Kaart 2 — "Mijn Schema"

`SchemaOverview`, standaard ingeklapt (referentie, geen dagelijks gebruik). Bevat de
oefening-templates plus de twee template-edit-ingangen `[Bewerken]` en `[Wijzig via Coach]`.

### Coach-nudge

Slanke regel (geen kaart) onderaan, ongewijzigd qua functie.

### "Net gestart"

Inline strook (geen volledige kaart) direct onder de header. Zie §7 voor exacte condities.

## 5. Componenten — wijzigingen

| Component | Actie |
|-----------|-------|
| `v2/SchemaBlockHeader.tsx` | Vereenvoudigen: één balk = blok-positie (gelabeld); sessie-balk-duplicatie eruit. |
| `SchemaProgress.tsx` | **Verwijderen.** W-segmenten verhuizen naar de week-kiezer in Kaart 1. |
| `SchemaCalendar.tsx` | Wordt Kaart 1. Week-kiezer = klikbare W-blokjes (vervangt chevrons + dots). Grid, verplaats-menu, `Aanpassen`, agenda-knop blijven. |
| `SchemaOverview.tsx` | Wordt Kaart 2, standaard ingeklapt. Absorbeert `[Wijzig via Coach]`. |
| `v2/SchemaCoachNudge.tsx` | Blijft, als slanke regel. |
| **Nieuw** `v2/SchemaStartedBanner.tsx` | Tijdgebonden + wegklikbare "Net gestart"-strook. |
| `SchemaPageContent.tsx` | Herindeling naar header + 2 kaarten + nudge + banner. |

## 6. Data-laag — gedeelde reconciliatie

**Nieuw:** `src/lib/training/reconcile-week.ts` — extraheert het token-model uit
`/api/schema/week` naar een pure, te testen functie die door **beide** endpoints gebruikt
wordt.

```
reconcileWeek(planned: PlannedSession[], actuals: Completion[]) -> ReconciledDay[]
```

**Titel-canonicalisatie** (de kern van de fix voor punt 3):

```
canon(title) =
  title.toLowerCase()
       .normalize('NFD').replace(/\p{Diacritic}/gu, '')   // diakrieten weg
       .replace(/\s*[—–-]\s+.*$/, '')                       // beschrijvende staart weg ("— Hinge Dominant")
       .replace(/\s+/g, ' ')                                // spaties normaliseren
       .trim()

titlesMatch(a, b) = canon(a) === canon(b)
```

**Matching-regels (cross-day, binnen dezelfde ISO-week):**

1. Pass 1 — exacte dag + `titlesMatch` (gym) / zelfde sport (run/padel).
2. Pass 2 — `titlesMatch` (gym) / zelfde sport op een andere dag in de week → sessie verschijnt
   op de actual-dag, geplande dag wordt leeg, herkomst `↩ <geplande dag>`.
3. Elke completion wordt maximaal één keer gebruikt (`used`-flag).
4. Niet-gekoppelde planned in het verleden = *missed* (verbergen, conform eerdere keuze Stef).
5. Niet-gekoppelde actuals = *extra* chip (`unplanned`).

**Disambiguatie** bij meerdere gym-dagen in een week: eerst exacte-dag-match (Pass 1), dan
titel-match-elke-dag (Pass 2). Titel is daarmee de tiebreaker; geen sport-only fallback.

**Aanpassing endpoints:**

- `/api/schema/route.ts` — vervang de inline 2-pass matcher door `reconcileWeek`; voeg
  `created_at` toe aan de `select` (voor de banner).
- `/api/schema/week/route.ts` — vervang het inline token-model door `reconcileWeek`.

## 7. "Net gestart" — exact gedrag

Toon de strook **alleen** als alle drie waar zijn:

1. `source_block_review_id` is gezet, **en**
2. `created_at` ligt binnen 72 uur, **en**
3. niet weggeklikt: `localStorage['schema-net-gestart-dismissed:<schemaId>']` ontbreekt.

- Wegklikken (`✕`) schrijft de localStorage-sleutel → strook blijft permanent weg voor dit
  schema.
- `[Ongedaan maken]` roept ongewijzigd `/api/block-review/undo` aan.
- Na 72u verdwijnt de strook automatisch; binnen dat venster is dit de enige plek voor de undo
  (de undo is alleen kort-na-aanmaken zinvol).

## 8. Styling-unificatie

Alle kaarten naar dezelfde v2-tokens: `rounded-[22px] border-[0.5px] border-bg-border
bg-bg-surface`. De afwijkende `rounded-2xl` (`SchemaOverview`) en `rounded-card-lg`
("Net gestart") verdwijnen.

## 9. Randgevallen

- **Vakantieweek / bodyweight / runs** — geclassificeerd als gym tenzij titel "hardlopen"/
  "run"/"padel" bevat; reconciliatie blijft sport-bewust.
- **Object-formaat `workout_schedule`** (legacy `{ days: {...} }`) — `parseSchedule` blijft
  beide formaten ondersteunen.
- **Meerdere workouts op één dag** — alle als aparte chips; elke completion één keer gebruikt.
- **Twee geplande sessies met dezelfde gecanonicaliseerde titel in één week** — match op
  datum-volgorde (Pass 1 vóór Pass 2).
- **Verplaatsen naar een dag die al een sessie heeft** — bestaande `reschedule`-override-logica
  blijft; de week-reconciliatie toont dan twee chips op die dag.
- **0 geplande sessies / lege week** — geen progress-deling door nul; lege staat.

## 10. Testaanpak

- **Unit tests voor `reconcile-week.ts`** (de te testen kern): matrix van
  `done-as-planned`, `done-swap`, cross-day-move (met canonicalisatie), `done-extra`,
  `missed`, meerdere-per-dag, en de canonicalisatie-functie zelf. Dit is de hoogste
  test-waarde en vervangt twee fragiele inline-matchers door één geteste.
- **Handmatig** (v1, conform CLAUDE.md): de UI-herindeling en de week-kiezer-interactie.
- **Verificatie tegen Stefs echte data** (zie §11).

## 11. Te verifiëren bij implementatie

Bevestig met Stefs echte gegevens dat canonicalisatie de titels daadwerkelijk overbrugt:
horen zijn Hevy-titels bij de schema-focus na het strippen van de beschrijvende staart
(`"Lower B — Hinge Dominant"` → `"lower b"` vs Hevy `"Lower B"` → `"lower b"`)? Zo niet — als
het echt andere woorden zijn — dan voegen we een handmatige "dit was \<geplande sessie\>"-
koppeling toe als fallback (apart story, buiten dit ontwerp).

## 12. Samenvatting van wat dit per punt oplost

- **Punt 1** — banner tijdgebonden (72u) + wegklikbaar (§7).
- **Punt 2** — 3 week-navigators → 1 klikbare week-kiezer; de "meter" krijgt betekenis en
  interactie; dubbele progress weg (§4, §5).
- **Punt 3** — gedeelde reconciliatie + titel-canonicalisatie; verschoven sessie verschijnt op
  de juiste dag, geplande dag wordt leeg (§6).
- **Bonus** — Home en Schema lopen gelijk (één matcher), consistente styling.
