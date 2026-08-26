# Pulse catch-up release runbook

This runbook is the production checklist for the catch-up release. Local and CI
validation do not replace the hosted checks below. Never copy `.env.local` into
a production command.

## 1. Before merge

Run from a clean checkout of the release commit:

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level=moderate
pnpm lint
pnpm typecheck
pnpm test
pnpm eval:ai
pnpm build
supabase db start
supabase test db
```

Run Playwright only against the loopback Supabase instance configured in
`.env.test.local`:

```bash
pnpm seed:testdata
pnpm test:e2e
```

Required manual iPhone checks: Safari and installed PWA, portrait and one
landscape rotation, keyboard-open chat, VoiceOver focus order, sheet focus
return, safe areas, and reduced motion. Record device/iOS/build and screenshots
in the pull request.

Before testing password recovery, configure hosted Supabase Auth:

- set **Site URL** to the exact production origin;
- add the exact production recovery callback
  `https://<production-origin>/auth/callback?next=%2Fauth%2Freset-password`;
- add `https://*-<vercel-team-or-account-slug>.vercel.app/**` only for Vercel
  previews, plus the required loopback development origins;
- keep the hosted minimum password length at eight or higher and verify the
  recovery email rate limit and SMTP delivery;
- if the recovery email template is customized, confirm it uses
  `{{ .RedirectTo }}` so the requested callback is preserved.

Request a recovery email only for a controlled account. Verify the email link
lands on `/auth/reset-password`, an expired link shows a safe error, a valid new
password signs the user in, and the old password no longer works. The UI always
uses an account-neutral confirmation; do not weaken it to reveal whether an
email address exists.

## 2. Database deployment

1. Take a Supabase database backup and record its identifier.
2. Apply the migrations through the normal linked-project deployment; do not
   use `db reset`.
3. Confirm the new migrations are present in `supabase_migrations.schema_migrations`.
4. Verify existing counts for `auth.users`, `workouts`, and `chat_messages`
   against the pre-deploy values.
5. Smoke-test: open an old chat with rich cards, send a new message, run one
   authorized cron manually, and verify its `cron_runs` row and cursor.

Review dead letters after every deploy and when `cron:*:item-failure` alerts:

```sql
select job_name, item_key, attempts, last_error, dead_lettered_at
from public.cron_item_failures
where dead_lettered_at is not null
order by dead_lettered_at desc;
```

After fixing the root cause, requeue one reviewed item by deleting only its
exact `(job_name, item_key)` failure row. The next scan will retry it. Never
bulk-delete this table; preserve unrelated backoff state.

The chat metric trigger, cron finalizer, and AI usage settlement have pgTAP
rollback tests in `supabase/tests/release_durability.test.sql`.

## 3. Exercise catalog promotion

The safe order is **import rows → upload media → match definitions**. First clone
the pinned dataset revision outside git and set `EXERCISES_DATASET_DIR`. Record
the dataset URL, commit SHA, license, row count, media counts, and operator in
the pull request.

Validated candidate revision for this release:

- URL: `https://github.com/hasaneyldrm/exercises-dataset`
- commit: `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
- metadata rows: 1,324 (schema validation passed locally on 2026-08-15)
- code, dataset structure, and instruction text: MIT
- images and GIFs: separate Gym Visual terms; **do not upload or publish them
  until Pulse has documented its own reuse license and required attribution**

The conservative matching dry-run currently accepts 105/455 definitions and
leaves 350 for reviewed overrides. This is intentional: partial token overlap
previously produced semantically wrong links. Do not lower the matcher threshold
or promote unmatched definitions in bulk.

Run all three dry-runs against local Supabase first:

```bash
pnpm import:catalog:dry-run
pnpm upload:catalog-media:dry-run
pnpm match:catalog:dry-run
```

For a hosted project, the scripts refuse to run unless all three independent
confirmations agree: `--production`, `PULSE_PRODUCTION_SUPABASE_PROJECT_REF`,
and `--confirm-project=<ref>`. Load production credentials from an ephemeral,
gitignored environment file or secret manager, then run:

```bash
tsx --env-file=.env.production.local scripts/import-exercise-catalog.ts --dry-run --production --confirm-project=<ref>
tsx --env-file=.env.production.local scripts/upload-exercise-media.ts --dry-run --production --confirm-project=<ref>
tsx --env-file=.env.production.local scripts/match-catalog.ts --dry-run --production --confirm-project=<ref>
```

Review counts and every unmatched definition. Only then repeat the same three
commands without `--dry-run`, in the order above. Verify:

```sql
select count(*) as catalog_rows from public.exercise_catalog;
select count(*) filter (where catalog_id is not null) as matched,
       count(*) filter (where catalog_id is null) as unmatched
from public.exercise_definitions;
```

Open at least one matched workout exercise and confirm thumbnail, animation,
equipment, and instructions load from the `exercise-media` bucket.

### Catalog rollback

Catalog promotion is idempotent, but it is not automatically reversible. Before
matching, export `exercise_definitions(id, catalog_id)` and the catalog table.
If matching is wrong, restore only those links in a transaction; do not delete
workout data. If media or reference rows are wrong, leave links null, correct the
dataset/override, and rerun. Delete the bucket or catalog rows only after a
database and storage backup is confirmed and the deployed application no longer
depends on them.

## 4. Secrets and observability

Before deployment, verify that Vercel and Supabase contain distinct values for:

- `CRON_SECRET`, `HEVY_WEBHOOK_SECRET`, `HEALTH_EXPORT_AUTH_TOKEN`
- `OAUTH_STATE_SECRET`, Google and Strava OAuth client secrets
- Supabase service-role key and Anthropic API key

Rotation order: create new value, update all senders and receivers, deploy,
exercise the integration, then revoke the old value. Never paste a secret into
the pull request or logs. After deployment, verify Sentry receives a deliberate
non-sensitive test event and that handled background/cron failures and the 70%
AI-budget warning are alertable. Confirm AI reservations settle and no stale
`running` cron rows remain after the smoke run.

## 5. Privacy status

Pulse stores health, workout, nutrition, injury, and coaching-memory data. RLS
and route ownership checks protect user boundaries, and sensitive ingest values
are no longer logged. This release does **not** claim complete GDPR/AVG product
support: there is no verified self-service export, retention policy, or
account-erasure flow. Before onboarding anyone beyond the current controlled
user set, define retention periods, processor/subprocessor records, consent and
privacy notice, a tested export, and cascade deletion including Storage and
third-party data. Treat that expansion as a separate legal/product release gate.

## 6. Release and rollback

Deploy the merged commit to preview first. Verify login and password recovery,
home, chat, workout detail, check-in, schema, nutrition, cron status, budget
status, and catalog media. Promote that exact commit to production; do not
rebuild from a different tree. Record Git SHA, migration versions, dataset SHA,
backup ID, Vercel deploy ID, and smoke results.

For application regressions, redeploy the last known-good Git SHA. Do not roll
database migrations back destructively: the new columns/functions are backward
compatible. Disable affected crons/integrations, redeploy application code, and
restore data only from the recorded backup when a verified data-corruption case
requires it.
