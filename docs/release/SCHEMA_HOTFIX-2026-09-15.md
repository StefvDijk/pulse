# Schema compatibility hotfix — 15 September 2026

Isolated from the database-dependent catch-up release. Base: main `0d1eb757`.
No migrations, package changes, new RPCs or external integration changes.

## Fixes

- Home accepts full date overrides without throwing on `toLowerCase`.
- Home, full calendar and reschedule use the same source-session resolution.
- Moved sessions preserve custom exercises, duration, extension metadata and
  unrelated overrides; explicit rest and empty exercise lists remain explicit.
- Reschedule rejects occupied destinations and stale/concurrent edits.
- Shared retry buttons invoke callbacks without injecting a click event into SWR.
- Escaped one pre-existing JSX apostrophe so the baseline lint command can pass.

## Evidence

- Unit suite: 90 files / 624 tests passed, including guarded-update conflict and
  legacy null timestamp/unrelated metadata tests. The old main suite logs a
  localhost connection error from an existing fetch test but exits successfully;
  this is not evidence of a live endpoint test.
- Webpack production build passed, 101 routes. Hosted default build remains a gate.
- Lint passed with 21 existing warnings, no errors.
- Local authenticated schema E2E: 3/3 passed (desktop Chromium, mobile Chromium,
  mobile WebKit). Unique local users are created and deleted per test, and the
  helper refuses non-local Supabase targets. AI credentials are absent by design.
- Both source and backport received read-only review; no remaining concrete
  blocker or database-dependent release import was found.
- Existing main ReadinessCard emitted nested-button console warnings during E2E.
  This hotfix does not address that existing UI defect or claim full-product QA.

## Deployment gates

Commit and push the exact source; stage a production-configured Vercel build
without assigning the stable alias. Check build and unauthenticated route guards,
then promote and inspect Home and moved-day exercise details using the owner's
existing signed-in browser. Keep the prior deployment available for rollback.

This is not approval to promote the large catch-up release. Import duplication,
Hevy freshness, misleading sync success, full coaching/writeback QA, database
restoration/migration and physical-iPhone/privacy gates remain open there.
