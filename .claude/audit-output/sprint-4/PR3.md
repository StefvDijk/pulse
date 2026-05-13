# PR3 — Defer `/api/schema/week` fetch until modal opens [D7]

**Target:** `audit-fixes-2026-05`
**Branch:** `fix/d7-schema-dedup` (stacked on PR2)
**Sprint:** 4 — Refactor (PR3 of 5)

## Summary

`SchemaPageContent` eagerly fetched both `/api/schema` (the 373-line route
that returns the full schema with every week) and `/api/schema/week`
(current-week workouts with set data) on every `/schema` page view — even
though the second endpoint is only needed when the user opens the Google
Calendar modal. `SchemaWeekView` did the same.

This PR moves the `useSchemaWeek` call into `PlanWeekModal` itself so the
request only fires when the modal opens.

## Changes

- `PlanWeekModal` now fetches its own week data. The outer component handles
  loading and empty states inside a new `ModalShell`; the existing form/submit
  logic lives in `PlanWeekModalContent` (internal, same file).
- `SchemaPageContent` and `SchemaWeekView` drop their `useSchemaWeek()` calls
  and the `days` prop they used to pass.
- `refreshWeek()` callbacks become global `mutate('/api/schema/week')` so the
  home cards and other subscribers still revalidate after schema changes.

## Commits

`3946fc5` — single commit.

3 files changed, +82 / −18 lines.

## Verification

- [x] `pnpm typecheck` — green
- [x] `pnpm lint` — 0 errors
- [ ] Manual smoke: open `/schema`, observe Network tab — only `/api/schema`
      and `/api/settings` should fire on mount, not `/api/schema/week`.
- [ ] Open the Calendar modal — `/api/schema/week` fires once, modal renders.
- [ ] Edit the schema, close the modal — home `TodayWorkoutCard` and
      `WeekAtAGlance` show the new state (global SWR revalidation works).

## Risks

- Initial paint of the modal is now slightly slower because the data fetch
  starts when the modal opens rather than being prewarmed. The 60 s SWR
  refresh interval on `useSchemaWeek` means cached data is usually already
  present from other home-page subscribers, so most modal opens still hit
  the cache without a fresh network request.
