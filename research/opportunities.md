# Pulse — Opportunity Backlog

**Datum:** 2026-05-01
**Bronnen:** 5 teardowns in `research/teardowns/` (Athlytic, Whoop, Oura, Training Today, Runna)
**Methode:** Cross-teardown thema's → confidence-gewogen RICE → ranked backlog
**Scope-keuze:** uitbreiden + verdiepen, niet snoeien

---

## A. Gap matrix — features vs concurrenten

`✓` = Pulse heeft het • `~` = gedeeltelijk • `✗` = mist

| Feature | Pulse | Athlytic | Whoop | Oura | Training Today | Runna |
|---|---|---|---|---|---|---|
| **Surfacing** |
| Hero readiness number op home (1 getal, 1 kleur) | ~ | ✓ | ✓ | ✓ | ✓ | ✗ |
| iOS widgets (home/lockscreen) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Apple Watch complication | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Push notifications (morning, drop, bedtime) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| "Why this number?" drill-down met contributors | ~ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Personal-baseline bands op charts | ~ | ✗ | ✓ | ✓ | ~ | ✗ |
| 14-day cold-start uitleg ("nog X nachten") | ✗ | ✗ | ~ | ✓ | ✗ | ✗ |
| **Prescriptive layer** |
| Daily strain/exertion target (band, niet alleen meting) | ✗ | ✓ | ✓ | ~ | ✗ | ✓ |
| Sleep score + recommended bedtime | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Auto-rebalance plan op missed sessions | ~ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **AI / coach** |
| Reactive chat met memory | ✓ | ✗ | ~ | ✓ | ✗ | ~ |
| **Proactive** AI nudges (cron-driven cards op home) | ✗ | ~ | ✓ | ✓ | ✗ | ✗ |
| Behaviour-correlation engine ("X = -Y% voor jou") | ✗ | ✗ | ✓ | ~ | ✗ | ✗ |
| Tone-of-voice selector voor coach | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Multi-week "Action Plan" arcs | ~ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Weekly long-form lesson | ✓ | ✗ | ~ | ✗ | ✗ | ✗ |
| Monthly performance assessment | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| **Run-coaching** |
| Race-anchored periodised plan generator | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Structured workout primitive (intervals + paces) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| VDOT-style pace zone derivation | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Watch handoff via .FIT export | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| **Strength** |
| Per-set Hevy depth | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Per-muscle-group acute:chronic | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Cross-cutting** |
| Multi-source ingest (gym + run + Apple) | ✓ | ✗ | ~ | ~ | ✗ | ✗ |
| Nutrition tracking | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Schema/program planning + calendar write | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Web-first (geen verplichte iOS) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Journal tag chips (auto-correlation input) | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ |

**Pulse's al-bestaande moats:** multi-source ingest, real LLM coach met memory + decay, per-muscle workload, nutrition, schema + Google Calendar write, weekly lessons artifact, eigenaarschap van eigen data. Géén concurrent matcht alle vier (gym + run + recovery + nutrition + LLM coach).

**Pulse's grootste structurele gat:** **alles wat met het wakker-worden-moment te maken heeft.** Geen widget, geen complication, geen push, geen hero-number op home dat instant beslissing geeft. Alle 5 concurrenten hebben dit.

---

## B. RICE-scoring (personal-use variant)

Voor 1-user product herinterpreteer ik RICE als:

- **Daily-touch (D)** 1-5: hoe vaak raakt dit jouw dagelijkse flow
- **Impact-per-touch (I)** 1-5: hoe veel waarde per keer
- **Confidence (C)** 0.5-1.0: hoe zeker dat het werkt zoals bedoeld
- **Effort (E)** 1-5 (story-points): hoeveel dev-werk

**Score = (D × I × C) / E** — hoger = eerder doen.

| # | Opportunity | D | I | C | E | Score | Tier |
|---|---|---|---|---|---|---|---|
| 1 | **Home hero readiness met "Why?" drill-down** — readiness al berekend, nu UX: één groot getal + verb ("Optimaal"/"Let op") + tap → contributors (HRV, sleep, workload, soreness) met personal-baseline bands | 5 | 5 | 0.9 | 2 | **11.3** | Now |
| 2 | **Proactive coach card op home (cron-driven)** — daily cron: Claude bouwt 1 nudge uit context + memory + lessons → toont als kaart op home. Reuses bestaande context-assembler & memory. | 5 | 5 | 0.85 | 2 | **10.6** | Now |
| 3 | **Daily strain/exertion target** — geen meting maar prescription: per dag een aanbevolen RPE/HR band o.b.v. workload + readiness + schema. Toont onder hero. | 5 | 4 | 0.8 | 2 | **8.0** | Now |
| 4 | **Sleep score + recommended bedtime** — sleep duration + efficiency + (Apple HRV) → score 0-100 + advised bedtime gekoppeld aan morgens schema. Data is er al via Apple Health. | 4 | 4 | 0.85 | 2 | **6.8** | Now |
| 5 | **Push notifications track** — 3 triggers: (a) morning readiness ready, (b) significant readiness drop vs 4d-avg, (c) bedtime nudge. Web push API → later iOS native shell. | 5 | 3 | 0.7 | 3 | **3.5** | Next |
| 6 | **Behaviour-correlation engine** — journal tag chips ("alcohol", "stress", "late dinner") op check-in en home; cron correlleert tegen readiness/sleep/HRV → toont "Voor jou: alcohol = -8% readiness gemiddeld". Reuses memory infra. | 4 | 5 | 0.7 | 4 | **3.5** | Next |
| 7 | **Monthly performance assessment** — long-form artifact (zoals weekly_lessons maar maandelijks) door Claude: trends, PRs, regressie's, narrative. Cron + tabel `monthly_assessments`. | 2 | 5 | 0.85 | 2 | **4.3** | Next |
| 8 | **14-day cold-start expectation UI** — "Pulse leert nog. Nog X nachten data nodig voor betrouwbare readiness." Voorkomt verkeerde initial trust. Kleine front-end task. | 3 | 3 | 0.95 | 1 | **8.6** | Now (quick win) |
| 9 | **Tone-of-voice selector voor coach** — system-prompt variant: "directe coach" / "vriendelijk" / "wetenschappelijk". Custom_instructions tabel bestaat al. | 3 | 3 | 0.8 | 1 | **7.2** | Now (quick win) |
| 10 | **Auto-rebalance plan op missed/skipped sessions** — als Hevy/Apple Workout van geplande sessie ontbreekt of skip_reason logged → Claude stelt nieuwe weekplan voor (we hebben skip_reasons + week_plan al). | 3 | 4 | 0.7 | 3 | **2.8** | Later |
| 11 | **Race-anchored run plan generator** — eigen periodised plan o.b.v. doel-race + huidige fitness. Kantelpunt: vervangt Runna of niet? Zonder dit blijft Pulse ingester. | 3 | 5 | 0.6 | 5 | **1.8** | Later (groot) |
| 12 | **Structured workout primitive + VDOT zones + .FIT export** — voorwaarde voor #11; native run-prescription stack. | 3 | 5 | 0.6 | 5 | **1.8** | Later (groot) |
| 13 | **Multi-week Action Plan arcs** — koppeling Goals + weekly check-in + memory in een 4-8 weken coached arc met daily check-in card. Bouwvoort op bestaande goals + checkin v1.1. | 3 | 4 | 0.7 | 3 | **2.8** | Later |
| 14 | **iOS widget + Watch complication** — native shell (Capacitor of native iOS app). Hoogste UX-impact per touch maar groot werk + verschuift stack. | 5 | 5 | 0.7 | 5 | **3.5** | Strategic call |
| 15 | **Workout-from-screenshot (Claude vision → Hevy routine)** — quick win: paste screenshot van Instagram-workout → Claude extract → Hevy push. | 2 | 3 | 0.7 | 2 | **2.1** | Later |

---

## C. Verdieping per bestaand scherm (Track B)

Welke huidige features kunnen scherper, op basis van wat concurrenten beter doen:

- **Home (`/`)** — biggest delta. Concurrenten openen met 1 hero number + 1 verb + 1 actie. Pulse heeft veel kaarten. Zie #1, #2, #8.
- **Workload (`/belasting`)** — wij hebben superieure science (per-muscle ACWR), maar concurrenten leveren *prescription* uit een vergelijkbaar getal. Zie #3.
- **Schema (`/schema`)** — auto-rebalance op missed sessions is Runna's killer. Zie #10. Plus een check-in moment "wijk je af van plan?" met Claude.
- **Coach (`/chat`)** — proactief vs reactief is de grootste gap. Zie #2, #6, #9.
- **Trends (`/progress` + `/trends`)** — personal-baseline bands ontbreken op de meeste charts. Oura's contributor-drilldown patroon is direct te kopiëren.
- **Check-in** — weekly v1.1 is ver. Toevoegen: tag chips voor correlation engine (#6), feed naar monthly assessment (#7).
- **Nutrition** — al sterk vs concurrenten. Geen directe verbeter-ticket uit teardowns; eventueel macro-target prescription analoog aan #3.

---

## D. Aanbevolen volgorde — eerste 4 sprints

**Sprint 1 — "Daily ritual"** (#1, #8, #9)
Hero readiness + cold-start UI + tone selector. Kleinste tickets, direct merkbaar. Zet de toon voor de rest.

**Sprint 2 — "Proactive coach"** (#2, #3)
Cron-driven coach card + daily strain target. Bouwt voort op bestaande context-assembler/memory. Maakt van Pulse de eerste echte LLM-coach in deze ruimte.

**Sprint 3 — "Sleep + correlations"** (#4, #6)
Sleep score + tag chips + correlation engine. Vult het wellness-blok in waar Oura/Whoop sterk zijn.

**Sprint 4 — strategic call** (#7 of #14)
Of: monthly assessment (#7, klein, hoge waarde) + push notifications (#5).
Of: starten met native iOS shell (#14) als je de widget/complication écht wil. Dit is een fork-in-the-road beslissing — Capacitor wrap of full native rewrite — en hoort een eigen brainstorm waard.

**Run-coaching diepte (#11, #12)** parkeren tot na sprint 4. Zonder die vier blijft Pulse "Runna-ingester met cross-context" en dat is op zich een geldige positie.

---

## E. Wat ik bewust niet voorstel

- **Snoeien van bestaande schermen** — expliciete scope-keuze van Stef.
- **Whoop/Oura's biosignal-stack chasen** — geen ring/band, dus niet matchbaar; hebzuchtige nutsverhouding.
- **Social/streaks/badges** — Pulse is solo product voor 1 user, retention via badges is leeg.
- **Pricing/business model werk** — het is een persoonlijk product, niet relevant.

---

**Volgende concrete actie als je hiermee akkoord bent:** Sprint 1 brainstormen — ik open `PLAN-SPRINT-1-DAILY-RITUAL.md` met UI sketches voor #1 (hero readiness layout), #8 (cold-start UI strings), #9 (tone selector locatie in settings).
