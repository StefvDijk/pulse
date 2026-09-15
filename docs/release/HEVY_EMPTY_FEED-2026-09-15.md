# Hevy empty-feed compatibility — 15 September 2026

## Reproduction

An incremental feed with one update returned HTTP 200 with
`{page:1,page_count:1,events:[...]}`. Normal UI sync imported the newest workout:
one Pulse row, five exercises and thirteen sets, matching the source's exercise
names and set metrics exactly.

Repeating sync returned a validation failure without duplicating or modifying that
workout. A read-only request using the advanced cursor showed the actual upstream
response: HTTP 200, `{page:1,page_count:1,workouts:[]}`. The client required `events`.
This reproduces the earlier recorded error; it is not an authentication failure.

## Correction and safety boundary

The client parser accepts this alternative empty envelope and normalizes it to
`events: []`. Generalized only to terminal pages (`page_count <= page`), not to
nonterminal empty pages. A strict empty tuple and strict object reject nonempty
workouts, error payloads and ambiguous shapes. Ordinary events retain their
existing validation; sync and cursor logic are unchanged. No migrations or new
dependencies are involved.

## Evidence

- The client regression first reproduced the missing-events Zod error, then passed.
- Eight regression cases pass, including six fail-closed alternative envelopes.
- Full main-based unit suite: 91 files / 632 tests passed.
- Read-only spec and standards reviews found no scoped blocker.
- Hosted build/CI and normal UI empty-feed re-sync remain deployment gates.

This does not close the catch-up release's atomic replacement, cron durability,
unknown-event handling or broader import/data-integrity work.
