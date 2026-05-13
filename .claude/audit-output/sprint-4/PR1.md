# PR1 — Centralize date/type/sport helpers [D1 + D9 + D10]

**Target:** `audit-fixes-2026-05`
**Branch:** `fix/d1-d9-d10-centralize-helpers`
**Sprint:** 4 — Refactor (PR1 of 5)

## Summary

Sprint 4 opens with three low-risk refactors that consolidate scattered helpers
and types. No behaviour changes — purely structural cleanup that pays off in
every subsequent PR by removing the noise of "where does X live?".

- **D1** — 25 inline `formatDate`/`formatTime`/`formatWeek`/`formatDateRange`
  variants replaced with imports from `src/lib/formatters.ts`. One module owns
  the nl-NL locale + UTC handling so future timezone bugs land in one place.
- **D9** — Handcrafted route response types (`MuscleMapResponse`, `ProgressData`,
  `CheckInReviewData`, `WeekPlan`, etc.) moved out of route files into
  `src/types/api.ts` and `src/types/check-in.ts`. Importers no longer cross the
  app/api boundary just to grab a type.
- **D10** — `Sport` + `SportType` lifted into `src/lib/constants.ts` so the
  literal `'gym' | 'run' | 'padel'` is only declared once.

Two follow-up chore commits clean up the lint baseline so subsequent PRs start
from a green slate (17 497 issues → 26, then 6 → 4, all remaining errors are
D5 territory addressed in PR2).

## Diff stats

| Commit | What |
|---|---|
| `9f61abb` | D1 formatters (~22 component / handler files updated) |
| `801cc69` | D9 route-type relocations + import rewrites |
| `5290214` | D10 Sport / SportType in constants.ts |
| `3be9c47` | chore(lint): ignore nested `.next`, local user dirs, `pulse/` docs |
| `24e3b7e` | chore(lint): `const` for non-reassigned schedule + drop empty interface |

51 files changed, +448 / −408 lines.

## Verification

- [x] `pnpm typecheck` — green
- [x] `pnpm lint` — 0 errors (4 remaining errors are setState-in-effect, scope of PR2)
- [ ] Manual UI smoke: visit `/`, `/progress`, `/schema`, `/check-in/review` — date labels look identical to pre-refactor

## Risks

- The eslint-ignore expansion is the only non-mechanical change. It only adds
  patterns (`**/.next/**`, `files/**`, `files lichaam/**`, `pulse/**`) that
  were never the canonical app source.
- D9 moves exported types between files. Any consumer that imported the type
  from the old route path will fail at compile-time, which `pnpm typecheck`
  catches.

## Test plan

- [ ] `pnpm typecheck` passes locally
- [ ] `pnpm lint` reports 0 errors
- [ ] Spot-check date rendering on home + progress pages still matches the
      pre-refactor screenshots
