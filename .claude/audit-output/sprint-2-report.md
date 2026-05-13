# Sprint 2 — Quick Wins (compleet)

**Datum:** 2026-05-13
**Branch:** `audit-fixes-2026-05`
**Fixes voltooid:** 22 — A6, A7, A10, G6 (Group A) · B5, B9, B10, B12 (Group B) · D12, D13, D15, G5, G7 (Group C) · E2, E4, E11, E12, E13 (Group D) · F1, F4, F5, F6 (Group E) · F3, G4 (Group F)
**Fixes deferred:** 2 — F8 (Group E) en F9 (Group E) — zie redenen onderaan

## Acceptance criteria

| # | Criterium | Status |
|---|-----------|--------|
| 1 | `pnpm typecheck` groen | ✅ 0 errors |
| 2 | `pnpm test` groen | ✅ 21/21 (vitest) |
| 3 | `pnpm audit --audit-level high` 0 high | ✅ nog steeds 0 (2 moderate, ongewijzigd) |
| 4 | `pnpm eval:ai` runt | ✅ 22/30 (gelijk gebleven — sprint 3 verbetert) |
| 5 | 6 commits met fix-IDs (één per groep) | ✅ |
| 6 | F3 migratie file in `supabase/migrations/` | ✅ `20260513143745_indexes_and_user_settings_trigger.sql` |
| 7 | `src/types/database.ts` geregenereerd | ✅ |
| 8 | Sprint-2 PR-body | ✅ Dit document |

## Per groep, per fix

### Groep A — Auth/Security XS (commit `db30d0e`)

| Fix | Wat | File |
|---|---|---|
| A6 | RLS-verify query opgeslagen. Run handmatig in Supabase SQL editor om te bevestigen dat de 4 tabellen geen `USING (true)` meer hebben. | `scripts/verify-rls.sql` |
| A7 | Hevy webhook auth nu via `crypto.timingSafeEqual` met length-check vooraf. | `src/app/api/ingest/hevy/webhook/route.ts` |
| A10 | OAuth state HMAC prefereert `OAUTH_STATE_SECRET`, valt terug op `CRON_SECRET` voor backwards-compat. Geen breakage als nieuwe env-var (nog) niet is gezet. | `src/lib/google/oauth.ts` |
| G6 | Rate-limits toegevoegd op `/api/check-in/{analyze,plan,review}` (30/min op AI-endpoints, 60/min op review-fetch). | 3 routes |

### Groep B — AI XS (commit `55d4750`)

| Fix | Wat | File |
|---|---|---|
| B5 | `loadCoachingMemory` cap op 30 meest-recente. | `src/lib/ai/context-assembler.ts` |
| B9 | `result.usage` failure gooit de DB-save niet meer onderuit; valt terug op `tokens_used: 0` en logt. | `src/app/api/chat/route.ts` |
| B10 | Stille catches in memory-extractor loggen nu (JSON-regex miss + JSON.parse fail). Geheim grepbaar in Vercel logs via `[memory-extractor]` prefix. | `src/lib/ai/memory-extractor.ts` |
| B12 | Sectie 8b "ANTWOORDLENGTE & STIJL" in chat-system prompt: 2-6 zinnen / ~100 words default; weekly review + schema-generatie tot ~250. Geen "Laat me weten als…"-afsluiters. | `src/lib/ai/prompts/chat-system.ts` |

### Groep C — Code-quality XS (commit `8e6948d`)

| Fix | Wat | File |
|---|---|---|
| D12 | `src/components/muscles/bodyMapData.ts` → `src/lib/body-map/data.ts`. Pure data hoort niet in components/. Lege `muscles/` dir opgeruimd. | rename + 1 import update in `MuscleHeatmap.tsx` |
| D13 | `hevyFetch<T>` generic verwijderd — returnt nu `Promise<unknown>`. Callers MOETEN Zod gebruiken om te parsen. | `src/lib/hevy/client.ts` |
| D15 | ProgressPage `activeExercise` nu inline derived (`selectedExercise ?? exercises[0]?.name ?? null`). useEffect+setState weg, één render-cycle bespaard. | `src/components/progress/ProgressPage.tsx` |
| G5 | `process.env.HEVY_API_KEY` fallback weggehaald in `hevy/sync.ts`. `user_settings.hevy_api_key` is nu single source of truth. | `src/lib/hevy/sync.ts` |
| G7 | Google Calendar besluit: **KEEP**. Integratie is wired (`syncSessionsToCalendar` in confirm, `listEvents` in plan, `calendar-integration.spec.ts`). Server-only guard ships in F1. | — (decision, no code change) |

### Groep D — UI/UX XS (commit `3618e7e`)

| Fix | Wat | File |
|---|---|---|
| E2 | `ReadinessSignal` rendert nu een 112px placeholder ipv `null` tijdens laden — geen layout-shift meer als kaart inlaadt. | `src/components/home/ReadinessSignal.tsx` |
| E4 | `pb-24` weg uit 8 pagina-containers: schema/, ProgressPage (3x), GoalsPage, WorkloadPage, SettingsPage, TrendsPage, WorkoutDetailPage (3x). Layout's `pb-[83px]` is genoeg voor de tab bar; dubbele padding gaf ~180px lege onderkant. | 8 files |
| E11 | Navigation tab bar vast op `bg-[#1C1C1E]/72`. Dark: variant werkte niet (geen `<html class="dark">`); was effectief altijd licht. | `src/components/layout/Navigation.tsx` |
| E12 | `motion-presets.listContainer` heeft nu `initial: {}` als safety net — voorkomt stille stagger-breakage als één child verkeerd variant heeft. | `src/lib/motion-presets.ts` |
| E13 | Dode `if (data.previousReview === null && confirmed) {}` block uit `CheckInFlow.tsx` verwijderd. | `src/components/check-in/CheckInFlow.tsx` |

### Groep E — Performance XS (commit `913e2f9`)

| Fix | Wat | File |
|---|---|---|
| F1 | `import 'server-only'` toegevoegd in beide googleapis-files. 194 MB lib gegarandeerd niet in client bundle. `server-only@0.0.1` als nieuwe dep. | `src/lib/google/calendar.ts`, `oauth.ts` |
| F4 | `/api/workouts/[id]` PRs-query en previous-workout-query nu in `Promise.all` (~50-100 ms sneller op detail page). | `src/app/api/workouts/[id]/route.ts` |
| F5 | `useSchema` poll uit: `refreshInterval: 0` + `revalidateOnFocus: false`. Schema verandert alleen na expliciete edit — mutate() doet de refresh. | `src/hooks/useSchema.ts` |
| F6 | `revalidateOnFocus: false` op `useExerciseList`, `useBodyComposition`, `useCoachingMemory`. Stale-data is fine bij tab-focus; expliciete `mutate()` calls vangen wijzigingen op. | 3 hooks |

### Groep F — DB migration (commit `1b3d4f0`)

| Fix | Wat | SQL |
|---|---|---|
| F3 | 3 indexen: `idx_workout_exercises_exercise_def` (JOIN-key), `idx_personal_records_workout` (PR-lookup), `idx_workouts_title_trgm` (GIN trigram voor ILIKE op title). Trigram wrapped in DO-block dat skipt als pg_trgm niet beschikbaar. | `20260513143745_indexes_and_user_settings_trigger.sql` |
| G4 | `public.handle_new_user()` SECURITY DEFINER function + `on_auth_user_created` trigger op `auth.users` AFTER INSERT. Voegt automatisch `user_settings` row toe — voorkomt `.single()` crash bij verse signup. | (same file) |

**Lokaal toegepast.** 3 indexen + 1 trigger geverifieerd via `pg_indexes` / `pg_trigger`. Types geregenereerd (geen shape-change; alleen metadata).

## Deferred (gedocumenteerd, niet stil overgeslagen)

### F8 — `select('*')` in dashboard/route.ts
Audit zegt P3, effort S. De drie queries (`weekly_aggregations`, `daily_aggregations`, `training_schemas`) zenden de hele Row terug; dashboard component-consumer doet onbekend wat met welke kolom. Restricting kolommen kan stil bugs introduceren als ergens een ongedocumenteerde kolom-toegang is. Voor de marginale snelheid niet in XS-budget. **Schuif naar sprint 4** waar D9/D10 (types centraliseren) toch een audit van consumer-fields vereist.

### F9 — ExerciseImage `unoptimized` + Hevy whitelist in next.config
Vereist: weten welk hostname Hevy gebruikt voor exercise-images. Audit had geen concreet voorbeeld; current images zijn alleen 28-36px icons waar de winst marginaal is. **Schuif naar sprint 5** wanneer iemand een paar exercise-images opgrepen kan hebben om het patroon te bevestigen.

## Eval-score check

`pnpm eval:ai`: nog steeds **22/30 (73.3%)**, gelijk aan sprint-1 baseline. Geen AI-laag wijzigingen die de classifier raken (alleen B5+B9+B10 op infrastructuur, B12 op prompt-stijl — geen routing-impact). Sprint 3 (B2) gaat dit verbeteren naar ≥85%.

## Rollback-plan per commit

```
git revert 1b3d4f0    # F3+G4 migration (run: docker exec ... < rollback-sql in commit footer)
git revert 913e2f9    # F1+F4+F5+F6
git revert 3618e7e    # E2+E4+E11+E12+E13
git revert 8e6948d    # D12+D13+D15+G5+G7 (rename revert restoreert oude pad)
git revert 55d4750    # B5+B9+B10+B12
git revert db30d0e    # A6+A7+A10+G6
```

De migratie heeft geen schema-altering changes (alleen idempotente CREATE … IF NOT EXISTS + trigger). Rollback-SQL staat als comment in de migration-file.

## Wat de baseline heeft gedaan

Sprint 1 totaal: 8 fixes, 6 commits.
Sprint 2 totaal: 22 fixes, 6 commits.
**Cumulatief**: 30 fixes, 12 commits boven `main`. 67 fixes totaal in scope minus 30 done = 37 te gaan.

## Volgende sprint

Sprint 3 (AI-laag) — 12 fixes in 4 PRs:
1. PR1: B2 (classifier edge cases)
2. PR2: B3 + A11 + D4 (write-back via AI SDK tools, geen XML meer)
3. PR3: B7 (read-tools voor body comp, schema, blessures, weekly agg)
4. PR4: B4 + B5* + B6 + B8 + B11 + B12* (context-refactor; B5 en B12 al uit sprint 2 — herzien voor consistency)

Voorbereiding voor sprint 3:
- `pnpm eval:ai > .claude/audit-output/eval-baseline-pre-sprint3.txt 2>&1` om absolute baseline vast te leggen
- Lees fase 2 rapport (`02-ai-system.md`)

Start: `/goal Sprint 3 voltooien volgens .claude/skills/fix-sprint-3/SKILL.md`
