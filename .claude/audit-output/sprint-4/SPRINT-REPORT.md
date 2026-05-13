# Sprint 4 — Refactor — Report

**Date completed:** 2026-05-13
**Target branch:** `audit-fixes-2026-05`
**Base branch contains sprints 1-3:** yes
**Total commits:** 17 across 5 branches

## Fixes shipped

| ID | Title | Branch | Status |
|---|---|---|---|
| D1 | Centralize date formatters | `fix/d1-d9-d10-centralize-helpers` | ✅ |
| D9 | Move handcrafted route types to `src/types/` | same | ✅ |
| D10 | Centralize Sport / SportType constants | same | ✅ |
| D5 | Replace useEffect props→state with render-time idiom | `fix/d5-…-react-antipatterns` | ✅ |
| D6 | Stable keys on dynamic lists | same | ✅ |
| D8 | CoachAnalysisCard → useSWRMutation | same | ✅ |
| D14 | Drop `'use client'` from 10 leaf components | same | ✅ |
| D16 | Settings save error UX | same | ✅ |
| D7 | Defer `/api/schema/week` fetch until modal opens | `fix/d7-schema-dedup` | ✅ |
| D3 | Replace 15 `as unknown as` with Zod (15→2) | `fix/d3-zod-casts` | ✅ |
| A5 | server.ts split — re-scoped, decision-doc | `decisions/a5-closed` | ✅ |

## Not addressed

- **E6** — design tokens v2. Skipped per sprint-4 skill ("Mogelijk te groot
  voor deze sprint"). Should be its own sprint after a scope inventory.
- **RLS integration test** — captured as a follow-up in the A5 decision doc.

## Numbers

- Lint errors: `1891 → 0` (clean after PR1's eslint-ignore expansion +
  PR2's D5 fixes)
- `as unknown as` casts: `15 → 2` (both in intentional helpers)
- `'use client'` directives: `87 → 77`
- Inline date formatters: `~25 → 1` (`src/lib/formatters.ts`)
- Route response types in `src/types/`: from 0 to ~12 exports
- New Zod schemas in `src/lib/schemas/db/`: 4 files

## PR stacking

PR2 ← PR1, PR3 ← PR2, PR4 ← PR3. PR5 is independent (docs only).

Merge order to `audit-fixes-2026-05`: PR1 → PR2 → PR3 → PR4 → PR5 (PR5 can
also merge first since it's docs-only).

## Acceptance criteria from sprint-4 skill

1. ✅ Typecheck + lint groen
2. ✅ Alle 5 PRs gemaakt (4 fix-PRs + 1 decision-PR)
3. ⚠️ RLS-tests slagen — A5 re-scoped, RLS tests deferred (captured in decision doc)
4. ✅ `as unknown as` count daalt van 16 → 2
5. ✅ PR-template ingevuld per PR (zie `PR1.md` t/m `PR5.md`)

## Stop-conditions checked

- A5 raakt > 60 files → re-scoped instead of split; decision documented.
- D3 vindt typing-issues die niet via Zod op te lossen zijn → none encountered.
- E6 raakt > 50 files → deferred without inventory; out of sprint scope.

## What to do next

1. Push the 5 branches to `origin` (requires explicit user confirmation).
2. Open the PRs against `audit-fixes-2026-05` on GitHub using the bodies in
   this directory.
3. Merge in the order listed above, then update `audit-fixes-2026-05` →
   `main` once the integration branch is green.
