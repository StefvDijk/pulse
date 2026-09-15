# Pulse delivery evidence — 15 September 2026

## Objective and status

Make Pulse work correctly across its existing product: imports, analysis, coaching,
training plans, account flows, mobile UI and production operations. The owner
confirmed these priorities on 15 September. **Not ready for production promotion.**
This record is incremental evidence, not a replacement for the audit or acceptance
criteria in `CATCH_UP_RELEASE_RUNBOOK.md`, the PRD and the July audit improvement plan.

## Authoritative baseline

- Release branch: `codex/catch-up-release`, initial HEAD `bec9832`.
- Production: Vercel deployment `dpl_2o2WpLov9dcDEuo73S5bbkduvm3g`, created 21 June,
  stable alias `https://pulse-two-omega.vercel.app`.
- PR #58 remains open/draft; existing CI is green for `bec9832`, not proof of any
  subsequent changes or production health.
- Hosted migration history ends at `20260621000002`; local test DB ends at
  `20260812000015`. The release must not be promoted before a reviewed migration.
- Supabase managed-backup listing returned an empty backup list and PITR disabled.
  Private logical schema and data exports completed (file mode 0600), but they
  are temporary and not a verified restoration. pg_dump warned about circular
  foreign keys in training schemas/block reviews and coaching memory/beliefs.
  A tested restoration and durable backup location remain required before migration.

## Reproduced and addressed in this change

1. **Homepage 500 on full dated training overrides.** `/api/schema` accepts an
   object containing `focus`, `exercises`, and `duration_min`; `/api/schema/week`
   asserted that every override was a string, then called `toLowerCase` on an object.
   The route now validates both supported formats and preserves edited exercises
   and duration. A moved title-only template also uses the source workout, not the
   destination weekday's exercises.
2. **Retry poisoned SWR data.** `ErrorAlert` forwarded a React click event to its
   zero-argument callback. When passed an SWR mutator this replaced cached data
   with the event, causing `WeekGlance` to crash on `days.map`. The shared retry
   control now invokes the callback without arguments.
3. **Live recovery without changing the training plan.** The two current date
   shifts contained exact copies of their templates. Equality was checked before
   converting only those overrides to title references using an optimistic
   `updated_at` guard. All other schema fields were verified unchanged. This is
   temporary compatibility recovery, not a substitute for the code fix above.
   The signed-in live homepage and the eight-week, four-session schema then loaded.
   Follow-up review found that the old live full-calendar route still chooses the
   destination weekday's exercises for title-only overrides. Loading the page is
   not proof that its day details are correct. Do not rely on moved-day exercise
   details until the isolated code hotfix is deployed and checked live.
4. **Calendar and reschedule disagree with Home.** All three now use one validated
   session resolver. Rescheduling carries exercises, duration and extension
   metadata, including unrelated overrides; it rejects occupied destinations and
   stale clients and guards against concurrent schema changes. Explicitly empty
   exercise arrays stay empty. Legacy day objects and numeric RPE remain readable.
   This follow-up is locally verified, not yet deployed.

## Verification completed

- Before changes: lint/typecheck/build (104 routes), 129 files / 797 tests passed.
- After fixes: lint/typecheck/build (104 routes), 131 files / 803 tests passed;
  focused regression suite 6/6.
- The two original regressions were first observed failing: override request 500
  with `overrideFocus.toLowerCase is not a function`, and retry receiving a click
  event. A real SWR recovery test verifies loaded data after retry.
- Local pgTAP: 7 files / 92 tests passed, including concurrent workout replacement.
- Existing local recovery + critical authenticated E2E: 14 passed, 4 deliberate
  duplicate-contract skips across Chromium, mobile Chromium and mobile WebKit.
- New full-override homepage E2E: 3/3 passed on those browser profiles, using a
  unique temporary local user per test with cleanup. This covers the API and the
  rendered homepage. The old seeded user had no active schema: the earlier suite
  navigating away from home did not catch this regression.
- Live browser: initial failure, retry crash, and restored home/schema were observed.
  This is desktop Chrome evidence, **not** physical-iPhone or full-app acceptance.
- Local E2E deliberately has no real AI/integration keys. Budget fallback messages
  are expected; these runs do not validate real model output, SMTP or external sync.
- Follow-up resolver: 132 files / 812 tests, lint and typecheck passed. Webpack
  production build passed (104 routes); local default Turbopack build was blocked
  by a sandbox port-binding restriction, including the escalated retry. The metadata
  preservation test first failed, then passed after a lossless parser correction.
  A second read-only review found no remaining concrete blocker in this scoped fix.
- Expanded schema E2E: 3/3 passed, covering full-calendar API contents, visible
  exercise detail and a subsequent move preserving custom exercises and duration.
  Repeated after the metadata correction: 3/3 passed in 24.0 seconds.
- Isolated main-based hotfix: 90 files / 624 tests and 101-route Webpack build
  passed; local schema E2E 3/3 passed. Lint has no errors and 21 pre-existing
  warnings. Existing main readiness UI logs a nested-button warning; do not
  mistake the scoped schema pass for full UI acceptance.

## Confirmed open work — do not mark these complete

| Area | Evidence / next verification |
|---|---|
| Apple Health duplicate runs | Four rows share one exact start/end/distance/duration but have different Health UUIDs. Import dedup runs within a request; identified rows bypass existing-time dedup. Reproduce repeated and concurrent uploads, fix ingestion identity, then repair only reviewed duplicates with backup and reaggregation. No production rows deleted. |
| Hevy freshness | Latest stored workout is still 26 July. Latest recorded Hevy sync failed because the events response had no `events` array. A key is configured; verify the source response/status before changing credentials or cursors. |
| Strava failure semantics | `sync.ts` catches derivation/aggregation failures but records success; `derive-runs.ts` ignores lookup errors and counts failed updates as matched. Needs regression tests and proper partial-failure/retry handling. |
| Coaching/readiness | Live text recommends the old weekday template rather than the moved session, and infers recovery from low ACWR with missing baseline inputs. Verify date overrides, stale context and medical/load wording; no model-quality claim from mocked tests. |
| Schema block lifecycle | Live week-one screen shows “schema ready next week / block 2” despite an eight-week block. Trace the nudge's source and date logic. |
| Catalog/media | Hosted catalog missing; source media rights not resolved. Local workout E2E observed an upstream image 404. Do not upload unlicensed assets or classify broken media as passed. |
| Deployment | Backup restoration, pending migrations, hosted auth/config, environment secrets/budgets, cron/Sentry smoke, then exact-SHA deployment and rollback evidence. |
| Full-product QA | Home, schema edit/reschedule, workouts/runs, health, nutrition, goals/progress/trends, check-in, chat history/cards/writebacks/undo, integrations and failure states still need end-to-end coverage. Standards review also found invisible chat-session delete errors and an unvalidated chat-session API response. |
| Mobile/privacy | Physical iPhone Safari/PWA/VoiceOver gates remain open. Preserve current controlled-user scope; privacy/export/retention/erasure requirements must not silently disappear from the full objective. |

## Next work

Finish the shared schema fix verification and push to the existing release PR.
Backport the no-migration schema/retry fix separately against main so production
can receive the correction without prematurely promoting the database-dependent release.
Then address import identity/data integrity and misleading sync success, complete
the requirement-by-requirement audit, and execute the production runbook. Keep
the overall goal active until live evidence supports the complete objective.
