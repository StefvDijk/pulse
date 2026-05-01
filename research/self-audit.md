# Pulse — Self-Audit (baseline)

**Datum:** 2026-05-01
**Doel:** Objectieve inventaris van wat Pulse vandaag heeft, als baseline voor competitor teardowns en gap-analyse. Geen aanbevelingen, geen interpretatie.

---

## 1. Tech baseline

- **Framework:** Next.js 16 (App Router), React 19, TypeScript strict
- **Styling:** Tailwind 4, dark-only, design system v2 (`design/design_handoff_pulse_v2/`)
- **Data:** Supabase (Postgres + Auth + RLS), 27 migraties
- **AI:** `@ai-sdk/anthropic` + `ai` SDK, Claude Sonnet
- **Charts:** Recharts + custom SVG (muscle map)
- **Calendar:** Google Calendar (`googleapis`)
- **Hosting:** Vercel (cron jobs voor sync + aggregaties)
- **State:** SWR

## 2. Schermen (top-level routes)

| Route | Status |
|---|---|
| `/` (home / today) | ✅ |
| `/workouts` | ✅ |
| `/schema` | ✅ |
| `/progress` | ✅ |
| `/nutrition` | ✅ |
| `/check-in` (weekly v1.1 in progress) | ✅ |
| `/goals` | ✅ |
| `/belasting` (workload) | ✅ |
| `/chat` (coach) | ✅ |
| `/settings` | ✅ |
| `/auth` | ✅ |
| `/dev` (intern) | ✅ |

12 user-facing routes.

## 3. Data bronnen (ingest)

- **Hevy** — webhook + 15-min cron sync (`/api/cron/hevy-sync`, `/api/ingest/hevy`)
- **Apple Health** — via Health Auto Export REST (`/api/ingest/apple-health`)
- **Apple Workouts** — via dezelfde Apple Health pipeline (workouts feed)
- **Runna** — (verifiëren: zit dit als aparte bron of via Apple Workouts?)
- **Handmatig** — nutrition logs, body composition, check-ins, goals
- **Google Calendar** — read + write (week-plan voorstellen)

## 4. Aggregaties / berekende lagen

- **Daily aggregate cron** (`/api/cron/daily-aggregate`)
- **Weekly aggregate cron** (`/api/cron/weekly-aggregate`)
- **Workload / belasting** (acute:chronic ratio, muscle load) — `lib/load`, `lib/muscle-map`
- **Baselines** (per metric) — `lib/baselines`, migration `metric_baselines`
- **Readiness** — `useReadiness`, `useReadinessSummary`
- **Triad** — `useTriadData` (vermoedelijk training/recovery/load combo)
- **Sport correlations & insights** — `useSportCorrelations`, `useSportInsight`
- **Body composition** (Apple Health + handmatig)

## 5. AI / Coach laag

In `src/lib/ai/`:

- **Context assembler** — bouwt minimal-context payload per chat request
- **Classifier** — (vermoedelijk routing/intent)
- **Memory:** extractor, decay, seed (coaching memory met decay over tijd)
- **Lessons extractor** — `weekly_lessons` tabel
- **Sport insight extractor**
- **Sync analyst**
- **Skills + tools** directories — Claude tool-use setup
- **Custom instructions** per user (`ai_custom_instructions`)
- **Usage logging** (`ai_usage_log`)

Endpoints: `/api/chat` (streaming), `/api/explain`, `/api/ai-context-preview`, `/api/coaching-memory`, `/api/weekly-lessons`.

## 6. Database schema (signals uit migraties)

Domeinen zichtbaar in 27 migraties:
- core: workouts, activities, exercises
- nutrition (incl. macros)
- chat + injuries
- schema (training plans) + scheduling
- goals
- aggregaties (daily/weekly)
- coaching memory (+ decay)
- weekly reviews / check-in v2
- body composition (handmatig + Apple Health + extra metrics)
- baselines per metric
- weekly lessons
- AI usage log + custom instructions
- google calendar tokens
- user profile
- skip reasons, PR reps

Geschat ~30 tabellen. RLS overal.

## 7. Custom hooks (client-side feature surface)

35 hooks in `src/hooks/`. Highlights:
- Today/dashboard: `useDashboardData`, `useTodayHealth`, `useTodaysMove`, `useReadiness`, `useTimeOfDay`
- Workouts: `useWorkoutsFeed`, `useWorkoutDetail`, `useExerciseProgress`, `useExerciseList`
- Schema: `useSchema`, `useSchemaWeek`, `useWeekPlan`, `useWeekConflicts`, `useCalendarEvents`
- Insights: `useTrendsData`, `useSportInsight`, `useSportCorrelations`, `useTriadData`, `useExplain`
- Health: `useBaselines`, `useBodyComposition`, `useMuscleMap`, `useWorkload`
- Coach: `useCoachingMemory`, `useWeeklyLessons`, `useCheckInHistory`, `useCheckInReview`
- Plumbing: `useReducedMotion`, `useEscapeKey`, `useBodyScrollLock`, `useGoalSparkline`, `useSettings`

## 8. Recente focus (laatste commits)

iOS polish track: modals a11y, body scroll lock, forms UX, reduced-motion compliance, audit verificatie. Geen nieuwe features in laatste ~5 commits — alleen hardening van bestaande surface.

## 9. Open backlogs

- `BACKLOG.md` (algemeen)
- `BACKLOG-CHECKIN-V2.md` (check-in v1.1)
- `PLAN-WEEKLY-CHECKIN.md` (Google Calendar write, week plan proposals)
- `PLAN-IMPLEMENTATION.md`
- `PLAN-UX-REDESIGN.md` (klaar volgens CLAUDE.md)

## 10. Richting: uitbreiden + verdiepen (geen snoei)

**Scope-keuze (2026-05-01):** Pulse blijft alle huidige schermen houden. Het werk gaat over (a) nieuwe features toevoegen die concurrenten wel hebben en wij niet, en (b) bestaande features scherper maken.

### Vragen voor Stef (door jou in te vullen)

1. **Welke 2-3 bestaande schermen voelen het meest "halve features"** — werken wel, maar je weet zelf dat ze beter kunnen? (Kandidaten op basis van code: workload/belasting, trends, schema, coach, nutrition.)
2. **Top 3 dingen die je nu nog buiten Pulse doet** waarvan je zou willen dat de app ze oppakte? (Bijv. handmatig in Notion bijhouden, in je hoofd berekenen, in andere app loggen.)
3. **Welke concurrent-feature heb je weleens gezien en gedacht "dat wil ik ook"?** Vrij associëren — Whoop sleep score, Athlytic recovery, Strava segmenten, Oura readiness, Runna race plan, etc.
4. **Daily usage signal:** Welke 1-3 schermen open je écht dagelijks? (Alleen om te weten welke verbeteringen meeste impact hebben — niet om weg te halen.)
5. **Runna:** zit die als aparte ingest of via Apple Workouts? (Niet zichtbaar als eigen `/api/ingest/runna`.)

### Twee parallelle research-tracks die hieruit volgen

- **Track A — Feature-gap (uitbreiden):** competitor teardowns → matrix van features die zij hebben en wij niet → RICE scoren → backlog
- **Track B — Feature-depth (verdiepen):** per bestaand scherm dat jij in vraag 1 noemt, kijken hoe top-2 concurrenten dat oplossen → concrete verbeter-tickets

---

**Volgende stap (na antwoord op vragen 1-5):** `competitor-teardown` skill template + Athlytic teardown (Track A start).
