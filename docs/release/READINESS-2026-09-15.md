# Pulse delivery evidence — 15 September 2026

## Objective and status

Make Pulse work correctly across its existing product: imports, analysis, coaching,
training plans, account flows, mobile UI and production operations. The owner
confirmed these priorities on 15 September. **The full catch-up release is not
ready for production promotion. The isolated schema and Hevy empty-feed hotfixes
are live and verified.**
This record is incremental evidence, not a replacement for the audit or acceptance
criteria in `CATCH_UP_RELEASE_RUNBOOK.md`, the PRD and the July audit improvement plan.

## Authoritative baseline

- Release branch: `codex/catch-up-release`, initial HEAD `bec9832`.
- Original production/rollback target: `dpl_2o2WpLov9dcDEuo73S5bbkduvm3g` (21 June).
- Current production: main merge `35437740184940d99fc0b212c0892e71911cfcea`,
  Vercel `dpl_HdmaR1j4KBN74bDWnBsuNHyXP1wi`, stable alias
  `https://pulse-two-omega.vercel.app` (verified by alias lookup after main build).
- Hotfix PR #59 merged after CI and hosted build passed. Its exact source commit
  was `863978a638b9d210a24c5b3f0e3cc96dcedcaa53`; production-configured staging
  deployment `dpl_3yyd6yiQ6LGUzWZifdx6S5W9sgaY` passed all three route guards (401
  without a Pulse session), then was promoted. Main's identical merge build
  subsequently took over the alias. No migrations were applied.
- Hevy empty-feed PR #60 then merged after 632 tests, typecheck, scoped lint,
  two read-only reviews, CI and Vercel build passed. Source commit `7eb1e11`.
  Normal live UI re-sync after deployment succeeded with synced=0/errors=0,
  preserved exactly one newest workout with the same five exercises/thirteen
  sets, and advanced the cursor. The earlier successful schema deployment
  (`dpl_tZwDcXouLGKLggdcgkLt4kzdmpGd`) remains a no-migration rollback target.
- PR #58 remains open/draft. CI passed for `6e232e4`. Main was merged into it as
  `89b7e23`, preserving after-response work and explicit local-only browser tests;
  all 812 unit tests and typecheck passed again after resolving three conflicts.
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
   not proof that its day details are correct. Before the hotfix the signed-in
   Upper A dialog showed squats/leg curls. After promotion it showed assisted
   pull-ups, dumbbell bench, chest-supported rows, lateral raises and curls.
4. **Calendar and reschedule disagree with Home.** All three now use one validated
   session resolver. Rescheduling carries exercises, duration and extension
   metadata, including unrelated overrides; it rejects occupied destinations and
   stale clients and guards against concurrent schema changes. Explicitly empty
   exercise arrays stay empty. Legacy day objects and numeric RPE remain readable.
   The no-migration version is now deployed; live Home and the moved Upper A
   exercise details were checked in the owner's signed-in Chrome tab.
5. **Chat history hides failures and trusts unvalidated responses.** The release
   now validates list data, shows loading and retry states, and retains a session
   after HTTP/network delete failure. Only confirmed deletion removes it from
   the cache. A nullable database message count is displayed as unknown, not zero.
   Three original regressions and one null-contract regression were observed
   failing first, then fixed. No real user chats were deleted in these tests.

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
- Hosted default Turbopack hotfix build also passed (101 routes). GitHub hotfix
  CI passed. This resolves the local Turbopack verification gap for that hotfix.
- Live Hevy read-only check: the configured key returned HTTP 200 and a valid
  `events` envelope, including this morning's workout. Before manual sync that
  workout had zero Pulse rows. Normal UI sync then reported one new workout;
  DB comparison confirmed exactly one row, all 5 exercises and 13 sets, with
  exercise names and all compared set metrics matching the source exactly.
  Stored sync record: success, synced=1, errors=0; cursor advanced to 15 September.
- A second normal UI sync kept the exact same single workout and 13 sets but
  reproduced the missing-events error. Read-only diagnosis identified the cause:
  Hevy returns `{page:1,page_count:1,workouts:[]}` for the empty change feed.
  The client regression first failed, then passed after normalizing only strict,
  terminal empty envelopes. Six malformed/ambiguous alternatives stay rejected.
  The separate no-migration correction passed its hosted/live gates in PR #60.
  Latest verified live sync record at 06:42:45 UTC: success, synced=0, errors=0.
- With Hevy and chat follow-ups: 133 files / 824 unit tests passed.
  Final combined release after merging both live fixes: lint/typecheck and
  104-route Webpack production build passed. Sentry still warns about a missing
  global React error handler; observability acceptance remains open.
- Chat history browser suite: 12/12 passed across desktop Chromium, mobile
  Chromium and mobile WebKit, including malformed list recovery and delete-error
  retry. The first run exposed an ambiguous old text selector after adding a
  loading message; the test now targets the named dialog rather than partial text.
- Live Home after successful Hevy re-sync shows the new Upper A workout and
  one weekly session. Its readiness sentence still incorrectly suggests Lower A;
  the schema/Hevy fixes do not validate that advice.

## Confirmed open work — do not mark these complete

| Area | Evidence / next verification |
|---|---|
| Apple Health duplicate runs | Four rows share one exact start/end/distance/duration but have different Health UUIDs. Import dedup runs within a request; identified rows bypass existing-time dedup. Reproduce repeated and concurrent uploads, fix ingestion identity, then repair only reviewed duplicates with backup and reaggregation. No production rows deleted. |
| Hevy reliability | Freshness and the empty-feed failure are fixed live; full newest-workout comparison and repeated no-op UI sync passed. Still verify unattended cron, transient errors, retry/cursor safety, unknown-event handling and atomic replacement with the full release. |
| Strava failure semantics | `sync.ts` catches derivation/aggregation failures but records success; `derive-runs.ts` ignores lookup errors and counts failed updates as matched. Needs regression tests and proper partial-failure/retry handling. |
| Coaching/readiness | Live text recommends the old weekday template rather than the moved session, and infers recovery from low ACWR with missing baseline inputs. `computeReadiness` selects only `workout_schedule`, ignoring overrides; summary cache is keyed only by user/date for four hours. Correct the resolver/context, cache invalidation and unsupported recovery wording, including deterministic fallbacks. No model-quality claim from mocked tests. |
| Schema block lifecycle | Live week-one screen shows “schema ready next week / block 2” despite an eight-week block. Trace the nudge's source and date logic. |
| Catalog/media | Hosted catalog missing; source media rights not resolved. Local workout E2E observed an upstream image 404. Do not upload unlicensed assets or classify broken media as passed. |
| Deployment | Backup restoration, pending migrations, hosted auth/config, environment secrets/budgets, cron/Sentry smoke, then exact-SHA deployment and rollback evidence. |
| Full-product QA | Home, schema edit/reschedule, workouts/runs, health, nutrition, goals/progress/trends, check-in, chat cards/writebacks/undo, integrations and failure states still need full end-to-end coverage. Chat-session list validation/delete error handling is now fixed locally, not deployed with the small hotfixes. |
| Mobile/privacy | Physical iPhone Safari/PWA/VoiceOver gates remain open. Preserve current controlled-user scope; privacy/export/retention/erasure requirements must not silently disappear from the full objective. |

## Next work

The schema/retry and empty Hevy-feed hotfixes are live and merged to main; the
draft release contains both corrections.
Next address import identity/data integrity, readiness context and unsupported
recovery claims, and misleading sync success. Complete
the requirement-by-requirement audit, and execute the production runbook. Keep
the overall goal active until live evidence supports the complete objective.
