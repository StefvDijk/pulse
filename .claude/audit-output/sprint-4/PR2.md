# PR2 — React anti-patterns [D5 + D6 + D8 + D14 + D16]

**Target:** `audit-fixes-2026-05`
**Branch:** `fix/d5-d6-d8-d14-d16-react-antipatterns` (stacked on PR1)
**Sprint:** 4 — Refactor (PR2 of 5)

## Summary

Five medium-risk React-pattern fixes. After this PR the codebase no longer has:
- useEffect doing prop-to-state synchronization,
- `key={index}` on user-editable lists,
- duplicated fetch logic (`handleRetry` re-implements the initial fetch),
- `'use client'` on pure presentational leaves, or
- silent save failures in Settings.

## Per-fix breakdown

### D5 — useEffect props→state synchronization
`useEffect(setX, [prop])` triggers an extra render every prop change and trips
the `react-hooks/immutability` lint rule. Replaced with the React docs idiom
(adjust state during render, gated by an inequality check on the previously
tracked value), so the work happens in the same render.

Files:
- `AIContextSection` — sync `currentValue` → `value`
- `WeekPlanCard` — sync `plan.sessions` → `sessions` (fetch-on-mount effect retained)
- `SettingsPage` — sync `data` → 10 form fields, gated on data identity
- `OnboardingCheck` (RSC) — JSX moved out of try/catch (separate React rule, same PR)

### D6 — stable keys on dynamic lists
Index keys make React reuse the wrong DOM node when items are removed or
reordered — leading to stale focus, broken controlled inputs, and ghost
animations. The user-editable lists now carry a generated `id`; read-only lists
use a content-prefixed key.

- `ManualAddition` + `GoalData` types gained `id: string`, generated via
  `crypto.randomUUID()` on insert
- `WeekReviewCard`, `CheckInFlow`, `ManualAddModal` — remove-by-id
- `OnboardingWizard` — `updateGoal(id, …)` / `removeGoal(id)`
- `DayDetailSheet` (read-only) — `${i}-${exercise.name}`
- `CoachAnalysisCard` (read-only) — `${i}-${insight.slice(0,32)}`

### D8 — CoachAnalysisCard → `useSWRMutation`
The component had three coupled pieces of state (`loading`/`error`/`hasFetched
ref`) and duplicated the entire fetch body in `handleRetry`. Switched to
`useSWRMutation` so a single `trigger` call drives both the initial fetch and
retry. Payload is memoised so retry can't drift from the original request.

### D14 — drop `'use client'` from 10 leaf components
Identified components with no hooks, no event handlers, and no browser-API
usage. Dropping the directive lets them render as Server Components when their
parent is a Server Component, shrinking the client bundle incrementally.

Touched: `home/{WorkoutFeedCard,TodayWorkoutCard,WeekAtAGlance,ActivityCard,
MuscleGroupDot}`, `progress/PRList`, `nutrition/{ProteinTracker,DayIndicator}`,
`dashboard/{SportSplit,AdherenceTracker}`. 77 `'use client'` directives remain
for future incremental sweeps.

### D16 — Settings save error UX
`useSaveStatus` previously caught errors silently and emitted only an `'error'`
status that `SaveButton` ignored — failed saves looked identical to idle.
Handlers also threw `new Error()` with no message.

- `SaveState` now carries `{ status, errorMessage }`
- `SaveButton` renders a red label + an inline `role="alert"` error message on
  failure
- New `patchSettings()` helper extracts `body.error` from the response so the
  server's actual reason for failure reaches the UI
- Three identical fetch+throw blocks consolidated through the helper

## Commits

| Commit | Fix |
|---|---|
| `9cb0716` | D5 useEffect→render-time idiom |
| `18f68a1` | D6 stable keys |
| `a65047f` | D8 useSWRMutation |
| `0e89c29` | D14 drop `'use client'` x10 |
| `83e61f7` | D16 Settings save error UX |

21 files changed, +219 / −208 lines.

## Verification

- [x] `pnpm typecheck` — green
- [x] `pnpm lint` — 0 errors (previously: 4 setState-in-effect errors, all fixed by D5)
- [ ] Manual UI smoke: open Settings, trigger a save failure (offline) — error banner shows reason
- [ ] Manual UI smoke: weekly check-in flow — add 2 manual entries, remove the first, verify the second stays put

## Risks

- D5's render-time setState pattern is uncommon in this codebase. It is the
  React-documented fix for prop→state sync; the lint rule explicitly accepts it.
- D6's `id` field is appended to existing interfaces — non-breaking for
  callers that don't read it, but check-in flow callers had to be updated.
- D14 is incremental; build-time impact is small until more components follow.
- D16 broadens the `useSaveStatus` return type (`SaveStatus` → `SaveState`).
  Three call-sites updated; the rename also touches `AIContextSection`.
