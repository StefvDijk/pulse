# PR4 — Replace `as unknown as` casts with Zod validation [D3]

**Target:** `audit-fixes-2026-05`
**Branch:** `fix/d3-zod-casts` (stacked on PR3)
**Sprint:** 4 — Refactor (PR4 of 5)

## Summary

The audit flagged 15 `as unknown as` casts as a structural type-safety smell.
This PR drives the count from **15 → 2**, with the two remaining instances
both intentional and isolated behind documented helpers.

The casts fell into four shapes, each handled differently:

- **Supabase join-result casts (7 casts)** — `as unknown as { started_at: string; … }`
  on rows from `select('*, workouts(…)')`. Replaced with `Schema.parse()` /
  `z.array(Schema).parse()` calls so we fail loudly on shape drift instead of
  silently widening the type.
- **`jsonb` write casts (6 casts)** — `as unknown as Json` is mechanically
  required because Supabase types `jsonb` as the `Json` union. Consolidated
  behind a `toJson<T>()` helper so the cast lives in exactly one file.
- **`jsonb` read cast (1 cast)** — value coming out of the schema column was
  cast to a typed array. Replaced with
  `z.array(WorkoutScheduleItemSchema).parse(value ?? [])`.
- **Auth monkey-patch (1 cast)** — extracted into a `patchAuthGetUser()`
  helper in `src/lib/supabase/server.ts` with an explanatory comment.

## New files

- `src/lib/schemas/db/json.ts` — `toJson<T>(value): Json` marker helper
- `src/lib/schemas/db/workout-with-exercises.ts` — `WorkoutWithExercisesSchema`
- `src/lib/schemas/db/exercise-definition-join.ts` — `ExerciseDefinitionJoinSchema`, `WorkoutJoinSchema`
- `src/lib/schemas/db/week-block.ts` — `WeekBlockSchema`, `ScheduleSessionSchema`

## Touched routes / libs

`progress/exercise/route.ts`, `progress/exercises/route.ts`,
`schema/week/route.ts`, `readiness/route.ts`, `schema/overrides/route.ts`,
`schema/route.ts`, `schema/reschedule/route.ts`, `hevy/routine-sync.ts`,
`writebacks.ts`, `supabase/server.ts`.

## Commits

| Commit | Category |
|---|---|
| `03d6ab5` | Cat A — join-cast hacks → Zod parse (D3 part 1) |
| `3e636a3` | Cat B — `toJson()` helper for jsonb writes (D3 part 2) |
| `4062be7` | Cat C — validate jsonb read-back with Zod (D3 part 3) |
| `407a26f` | Cat D — isolate auth-getUser patch behind helper (D3 part 4) |
| `0330125` | follow-up cleanup of D3 part 4 |

## Verification

- [x] `pnpm typecheck` — green
- [x] `pnpm lint` — 0 errors
- [x] `grep -rn "as unknown as" src/ --include="*.ts" --include="*.tsx" | wc -l` → 2
      (both in intentional helpers: `lib/schemas/db/json.ts:9` and `lib/supabase/server.ts:15`)

## Risks

- `Schema.parse()` throws a `ZodError` (→ 500) when Supabase returns data that
  doesn't match the declared shape. This is the desired behaviour — silent
  widening hid real bugs — but expect to see new 500s if a join returns a
  shape the schema does not anticipate. The first place to check on such an
  error is the matching schema file in `src/lib/schemas/db/`.
- No integration tests added. Routes touching Supabase are not currently
  covered by the test suite; adding mocked-Supabase tests would be a separate
  workstream.

## Test plan

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` reports 0 errors
- [ ] Manual smoke of the touched routes: `/progress/<exercise>`,
      `/schema`, `/readiness`, weekly check-in confirm (writes schema),
      Hevy routine sync.
