# PR5 — Close A5 with single-user re-scope decision

**Target:** `audit-fixes-2026-05`
**Branch:** `decisions/a5-closed` (independent — not stacked on the fix branches)
**Sprint:** 4 — Refactor (PR5 of 5, docs-only)

## Summary

A5 in the original audit recommended splitting `src/lib/supabase/server.ts`
into a service-role client (`admin.ts`) and a user-scoped SSR client
(`ssr.ts`), updating ~40 importers, and adding RLS regression tests.

That recommendation assumes a multi-user app. Pulse runs in **single-user
mode**: `PULSE_USER_ID` hardcodes the only legitimate owner, and
`createClient()` already returns the admin client with `auth.getUser()`
monkey-patched (see `patchAuthGetUser()` introduced in PR4 / D3 part 4).
Splitting the file therefore has no security substance — it would be cosmetic.

This PR records the reasoning in `.claude/audit-output/decisions/A5.md` so a
future audit run does not silently re-flag A5 as actionable without
re-evaluating the single-user premise. The doc also captures three low-priority
follow-ups if the single-user assumption ever changes:

1. Rename `createClient` → `createServerClient` for clarity (~40 importers)
2. `assertOwner(client)` helper for routes that take a user ID from URL/query
3. RLS smoke test that inserts two users and asserts cross-user isolation

## Why this is safe to close without code

The security substance A5 wanted is already present:

| A5 concern | Where it lives |
|---|---|
| `auth.getUser()` patch isolation | `patchAuthGetUser()` in `server.ts` (PR4) |
| RLS policies verified | sprint-1 A6 + `supabase/migrations/*_rls_*` |
| `user_settings` row created on signup | sprint-1/2 G4 |
| Service-role boundary documented | JSDoc on `createAdminClient()` |

Supabase RLS is the actual enforcement layer regardless of which client is
used. If Pulse onboards a second user later, the existing RLS policies keep
their data isolated even if every route continues to use the admin key.

## Commit

`44cd360` — `docs(audit): close A5 with single-user re-scope decision`

1 file added, +64 lines.

## Verification

- [x] No code changes
- [x] `pnpm typecheck` and `pnpm lint` unaffected
- [x] Decision references the related single-user decisions (A4, G1, G3)
      already deferred earlier in the audit
