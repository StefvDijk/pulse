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

### Readiness data-path follow-up (release only)

- CI for release `08b0394` was rechecked: quality, migrations and Vercel all passed.
- Reproduced the live wrong-session symptom through the real readiness calculation:
  a Tuesday move of Upper A returned Lower A. The calculation now reads dated
  overrides and uses the same validated resolver as the calendar, preserving
  title, object, explicit-rest and legacy schedule compatibility.
- A second regression reproduced four-hour stale summary data after changing
  today to rest. Cache reuse now follows a fresh input read and comparison,
  including check-ins, load and history availability. Identical inputs still
  reuse model text; the client refresh interval now matches the one-minute
  dashboard cadence. A failed history read is an error, not a fabricated cold start.
- Further red-to-green regressions cover per-metric yesterday fallback after a
  partial import, exactly 72 hours of recent sessions (no future sessions), and
  exclusion of future biometric dates. The card labels this count `3d`, not `7d`.
- Read-only hosted check identified the apparent sleep contradiction: the newest
  sleep record is **2026-08-14, 463 minutes**. September 13–15 activity rows have
  null HRV and resting heart rate. The separate sleep card shows old data as
  “afgelopen nacht”; readiness correctly has no recent sleep. No health rows changed.
- This patch does **not** validate model advice or calibrate the readiness score.
  Still open: authoritative recovery claims with absent inputs, fixed-population
  metric bars, baseline freshness/window semantics, legacy multi-week selection,
  schema start/end bounds and date provenance for yesterday fallback. Do not
  promote this data-path patch alone as a trustworthy recovery recommendation.
  The source review also found that the explanation topic still describes the
  old scoring formula. These are concrete follow-up requirements, not accepted
  limitations for the finished product.
- Scientific caution informing that follow-up: an ACWR value is not an individual
  training clearance. See [Impellizzeri et al., conceptual pitfalls](https://pubmed.ncbi.nlm.nih.gov/32502973/)
  and the [original analysis of chronic-load substitutions](https://pubmed.ncbi.nlm.nih.gov/33332011/).
- Verification: 13 new regression/compatibility cases; full suite **134 files /
  837 tests passed**, full lint passed, 104-route Webpack build passed. The first
  standalone typecheck collided with the build rewriting `.next/types` (TS6053
  missing generated files); the build's own TypeScript phase passed. Standalone
  typecheck repeated after the build also passed. No new live deployment,
  production data mutation or database migration in this follow-up.

| Area | Evidence / next verification |
|---|---|
| Apple Health duplicate runs | Four rows share one exact start/end/distance/duration but have different Health UUIDs. Import dedup runs within a request; identified rows bypass existing-time dedup. Reproduce repeated and concurrent uploads, fix ingestion identity, then repair only reviewed duplicates with backup and reaggregation. No production rows deleted. |
| Hevy reliability | Freshness and the empty-feed failure are fixed live; full newest-workout comparison and repeated no-op UI sync passed. Still verify unattended cron, transient errors, retry/cursor safety, unknown-event handling and atomic replacement with the full release. |
| Strava failure semantics | `sync.ts` catches derivation/aggregation failures but records success; `derive-runs.ts` ignores lookup errors and counts failed updates as matched. Needs regression tests and proper partial-failure/retry handling. |
| Coaching/readiness | Resolver, input-aware cache and data-window corrections are implemented on the draft release, not live. Finish missing-data/confidence semantics, unsupported recovery wording (including deterministic fallback), old sleep shown as last night, and the outdated formula explanation before promotion. No model-quality claim from mocked tests. |
| Schema block lifecycle | Live week-one screen shows “schema ready next week / block 2” despite an eight-week block. Trace the nudge's source and date logic. |
| Catalog/media | Hosted catalog missing; source media rights not resolved. Local workout E2E observed an upstream image 404. Do not upload unlicensed assets or classify broken media as passed. |
| Deployment | Backup restoration, pending migrations, hosted auth/config, environment secrets/budgets, cron/Sentry smoke, then exact-SHA deployment and rollback evidence. |
| Full-product QA | Home, schema edit/reschedule, workouts/runs, health, nutrition, goals/progress/trends, check-in, chat cards/writebacks/undo, integrations and failure states still need full end-to-end coverage. Chat-session list validation/delete error handling is now fixed locally, not deployed with the small hotfixes. |
| Mobile/privacy | Physical iPhone Safari/PWA/VoiceOver gates remain open. Preserve current controlled-user scope; privacy/export/retention/erasure requirements must not silently disappear from the full objective. |

## Next work

### Sleep date / failure-state follow-up (release only)

- The historical sleep-score card regression was observed failing with the actual
  August 14 date, then fixed: only today's Amsterdam date is labelled “afgelopen
  nacht”; older records display their full date, including the year.
- Failed loads now remain visible with retry. Imported but incomplete sleep no
  longer says that no sleep was imported. Client response validation rejects
  invalid dates/scores and a scored record without a date.
- The score calculation now excludes future sleep dates so they cannot hide the
  newest available night. The regression first returned September 16 while the
  Amsterdam clock was September 15, then passed after adding the date bound.
- Ten focused tests cover these cases and the Amsterdam/UTC midnight boundary.
  No production records changed and this is not deployed to main.
- Full verification: 136 test files / 847 tests, lint and standalone typecheck
  passed. Owner confirmed that all relevant Health Auto Export metrics are enabled
  but the watch is only worn some nights. Missing readings must be supported as
  normal missing input, not interpreted as recovery or automatically blamed on
  export configuration. This does not yet prove why every specific night is absent.
- Remaining related work: `DailyHealthBar` uses one activity date for independently
  dated sleep data; `/api/health/today` does not surface query errors and omits
  sleep provenance. Fix that path too. Sleep-baseline date alignment and the
  broader readiness confidence/wording requirements remain open. Do not call the
  entire sleep/health experience complete based on this card correction.

The schema/retry and empty Hevy-feed hotfixes are live and merged to main; the
draft release contains both corrections.

### Daily health provenance / errors (release only)

- Reproduced missing sleep provenance through `/api/health/today`: current steps
  and August sleep were returned under one current date. Added `sleep_date`
  without changing the historical sleep value or existing activity/weight fields.
  DailyHealthBar now displays the sleep date separately, including year, and uses
  the response's Amsterdam day instead of the browser's UTC day.
- All four database query failures previously returned 200. Regressions now prove
  500 for each failed source, and the UI offers retry for HTTP/network failures.
  Authentication remains required. Client response validation rejects malformed
  measurements/dates rather than displaying NaN or crashing a date formatter.
- Old sleep, activity and weight values are not compared to today's baseline as
  if they were current. Tests preserve the baseline comparison for current data.
- Twelve focused route/UI cases pass, including UTC-midnight and baseline cases.
  Full suite: 138 files / 859 tests; lint and standalone typecheck passed.
  Previous sleep commit `832bd6b` also passed GitHub quality/migration checks and
  the hosted Vercel preview build (checked before this follow-up was pushed).
  No production data changes or live deployment in this follow-up. Remaining:
  end-to-end mobile acceptance, broader baseline freshness and missing-readiness
  semantics, plus the ingestion/release gates above.

Next address import identity/data integrity, readiness context and unsupported
recovery claims, and misleading sync success. Complete
the requirement-by-requirement audit, and execute the production runbook. Keep
the overall goal active until live evidence supports the complete objective.

### Missing-recovery assessment follow-up (release only)

- Reproduced `70/100, normal` with every recovery input absent. The calculation
  now returns `score: null, level: unknown` if no usable HRV/RHR deviation, sleep
  score or subjective check-in contributed. ACWR is retained as load context but
  cannot independently manufacture a recovery assessment. Existing arithmetic
  for genuinely available recovery inputs is unchanged, not newly validated.
- The summary API skips model generation for unknown recovery and returns an
  explicit missing-data explanation. The dashboard distinguishes insufficient
  data from a failed request and will not replace unknown with an older score
  from the other independently refreshing endpoint. The alternate readiness
  signal also supports unknown without rendering a numeric ring.
- Regression tests cover no data, load-only across three ratios, unbaselined
  heart data, API model-call suppression, both stale-client arrival orders and
  the visible card state. Cache tests now explicitly seed a neutral subjective
  check-in so they continue to test model-text reuse for a real assessment.
- Still open: numeric-score calibration/confidence with sparse but nonempty
  inputs, confident wording/fallbacks for numeric scores, misleading baseline
  countdowns/bars, contributor/explanation consistency and wider coach triggers.
  This is not proof that all recovery recommendations are ready for production.
- Verification so far: targeted regressions pass; earlier full 862-test run
  passed before the final five cases were added. Subsequent full local runs hit
  worker-start timeouts on unrelated, different files (five workers initially;
  one worker with maxWorkers=2, 137 files/863 executed tests passed). Do not call
  those final runs green. No assertions were relaxed; await exact-commit CI.
- Browser test: desktop Chromium and mobile WebKit passed. Mobile Chromium first
  timed out filling the login form before reaching the target screen; an unchanged
  traced rerun passed in 7.2s. All three profiles have exercised the target state,
  but the transient login stall has no proven root cause yet.
- Final exact-code verification: commit `dfa7095c4702ce45d78cbe6fe14712579032a89c`,
  [CI run 34962058927](https://github.com/StefvDijk/pulse/actions/runs/34962058927),
  passed **138 files / 867 tests**, typecheck, production build and migrations.
  Vercel preview also passed. This resolves the missing full-run evidence for
  this code change; it does not diagnose the local worker-start timeouts.

### Strava run derivation failure safety (release only)

- Reproduced two unsafe read paths through the real Supabase client with mocked
  database HTTP responses: failed linked-run and Health-candidate lookups both
  continued to insert a new run and reported zero failures. Both now stop work
  on that activity and increment `failed`; an unavailable lookup is not proof
  that a run does not exist.
- Reproduced failed linked-run and Health-match updates being counted as
  successful matches. Both now increment `failed`, not `matched`.
- Six regression cases exercise these four error paths, retry after a read
  failure, and successful insertion after genuinely empty lookups. The focused
  Strava suite passes 8 tests; typecheck and scoped ESLint pass.
- Full local run with two workers: 138 files / 870 tests passed, but
  `run-coach-manager.test.ts` failed to start its worker (timeout). This run is
  not green; exact-commit CI still needs verification.
- This does not yet repair top-level sync success/audit semantics, empty-feed
  retry, historical reaggregation, equivalent walk/activity error paths, or
  concurrent imports. No production records were changed or deduplicated.

### Strava walk and other-activity failure safety (release only)

- Extended the run regression contract to walks using the real Supabase client
  and mocked database HTTP responses. Reproduced the same unsafe insertion after
  failed lookups and false successful-match counts after failed updates.
  Walk derivation now stops that activity on lookup errors and reports all
  failed writes via `failed`, consistent with runs.
- Other sports also reproduced insertion after a failed linked-activity lookup.
  Those lookups now fail closed; failed inserts and updates are counted rather
  than silently omitted from the result.
- Shared regression file is now `tests/lib/strava/derive-failure-safety.test.ts`.
  Focused suite: 19 tests pass, including successful retry after a failed insert
  for runs and walks. Final typecheck, scoped lint and diff whitespace checks
  pass. Full exact-commit CI remains to be verified for this extension.
- The preceding run-only fix `b31d16ca76de241b8febfd7bb66c8b320d0b70d2`
  passed [CI run 34973434530](https://github.com/StefvDijk/pulse/actions/runs/34973434530):
  audit, lint, typecheck, tests, build and database migration checks. That clears
  its missing hosted verification, not the unexplained local worker timeout.
- Top-level sync still ignores failure counts/caught exceptions and can report
  success. Fixing its public error/audit contract, empty-feed retries and
  reaggregation remains required before Strava can be called release-ready.
  No live import or production data mutation was performed.

### Strava sync completion contract (release only)

- Reproduced the real sync function resolving successfully with an activity
  derivation result containing `failed: 1`. Sync now collects explicit failure
  counts and caught derivation/reaggregation exceptions, records an error audit
  and rejects rather than updating last-success and returning success.
- Also reproduced a failed last-success timestamp write being ignored. It now
  rejects; the nonempty-feed processing path records this failure as well.
- Seven sync cases use real OAuth token lookup, Strava client, Supabase clients,
  derivation helpers, aggregation helper and audit writer, with only HTTP I/O
  and Next's after-response scheduling substituted. They cover a row failure,
  each of the three cache-read failures, aggregation failure, timestamp failure
  and successful completion. All 26 focused Strava tests, typecheck, scoped lint
  and diff checks pass. Exact-commit full CI still needs verification.
- Previous walk/activity fix `58ee4adc1d21a03951c5833482a044da718cda1f`
  passed [CI run 34973910076](https://github.com/StefvDijk/pulse/actions/runs/34973910076).
- Still required: empty-feed cached retries (current early return skips them),
  auditing failures before/within that early path, aggregating all affected
  cached dates rather than only freshly fetched run/walk days, pagination and
  payload validation, and concurrent import safety. This is not a claim of
  complete Strava correctness or release readiness. No production data changed.

### Empty-feed retry and cached-date reaggregation (release only)

- Reproduced an empty upstream feed returning null derivation results despite
  cached work. Removing that early return exposed the second failure: derived
  historical activities did not trigger any aggregation. Empty feeds now skip
  only raw upsert, not derivation, failure auditing or reaggregation.
- After successful derivation, sync loads cached dates for the user in stable
  500-row pages and rebuilds unique Amsterdam days, weeks and months, including
  other sports and dates outside the upstream fetch window. Processing failures
  prevent this stage and last-success advancement; a subsequent retry can finish.
- Tests verify empty-feed processing, no empty raw upsert, Amsterdam midnight
  boundaries, historical day/week/month writes, a second date page, and eight
  completion/failure scenarios with both empty and nonempty feeds.
- Verification: 37 focused Strava tests pass; full local suite **140 files /
  902 tests passes**, typecheck, scoped lint and whitespace checks pass.
  The preceding `fd9014c4486ed4b86110fd3b75a71ae5e6bbde9a` also passed
  [CI run 34974545223](https://github.com/StefvDijk/pulse/actions/runs/34974545223).
- Still open: derivation helpers themselves read a bounded database response
  without pagination; full-history work cost/timeouts, upstream pagination and
  payload validation, pre-processing failure audits, concurrent import safety,
  and sport coverage in aggregate calculations. Scheduling all cached dates
  does not prove the aggregates count every sport correctly. No production data
  was modified; full release remains draft.

### Complete cached Strava derivation input (release only)

- Reproduced all three derivation helpers processing only the first database
  response, reporting zero failures while the next activity was never looked up.
  Runs, walks and other sports now share a cached-input loader that reads stable
  500-row pages ordered by start date and unique Strava activity id.
- The loader reads all pages before derivation writes. A failed later page
  throws rather than processing an incomplete input and claiming success.
- Six new cases cover activity 501 and a failed second page for each sport
  category, through the actual helpers and Supabase client with HTTP fixtures.
  The 43 focused Strava tests, typecheck and scoped lint pass. Full local suite:
  **140 files / 908 tests passed**. Diff whitespace check passes.
- This fixes database-response truncation, not concurrent snapshot consistency
  or serverless runtime limits. Derivation still updates cached rows serially;
  large-history performance needs explicit verification and likely incremental
  processing before claiming robust production-scale sync. No production data
  was changed.
