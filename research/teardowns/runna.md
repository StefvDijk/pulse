# Runna — Teardown
**Researched:** 2026-05-01
**Sources:**
- https://www.runna.com (official site, plan builder, pricing page)
- App Store listing (UK/NL) — Runna: Running Training Plans
- Reddit r/Runna (recurring threads on plan rigidity, pace adjustment, Strava integration)
- Strava acquisition coverage: TechCrunch, The Verge, Strava blog (April 2025) — Strava acquires Runna for undisclosed sum
- Comparison context: TrainingPeaks (CTL/ATL/TSB model), Final Surge (coach-led), Stryd (power-based)

## 1. Snapshot
Runna is a UK-founded (2021, Ben Parker & Dom Maskell) iOS/Android app that generates personalized running plans for a target race (5K → ultra) or general fitness goal. Acquired by Strava in April 2025; remains a standalone app with deeper Strava sync. Reportedly >1M users, ~£20M ARR pre-acquisition. Core promise: "the plan a £200/month coach would write, for £15/month."

## 2. Jobs-to-be-done
- "Get me to a sub-X 10K / half / marathon by date Y without overtraining."
- "Tell me exactly what to run today and at what pace."
- "Adapt the plan when life happens (illness, missed run, travel)."
- "Make my easy runs actually easy and my intervals actually structured."

## 3. Killer features (top 3-5)
1. **Race-anchored plan generator** — pick race + date + current 5K time, get a 4-24 week block with periodisation (base → build → peak → taper).
2. **Structured workout player** — guided audio cues for warmup / interval / recovery / cooldown with target pace ranges; works on Apple Watch, Garmin, COROS.
3. **Plan adjustment** — slide runs between days, swap workout types, push the race date; plan rebalances automatically.
4. **Strength & mobility add-ons** — bodyweight S&C and prehab sessions tied to the running phase.
5. **Pace zones from a single recent effort** — bootstraps zones from one parkrun / 5K time trial instead of lab testing.

## 4. Daily-loop screen
The "Today" tab is the heart. It shows: today's session as a hero card (e.g. "5x 1km @ 4:15-4:25, 90s rec, total 8.2km"), a one-tap "Start workout" → handoff to watch, and the next 2-3 days as smaller cards. Below: a horizontal week strip with checkmarks for completed sessions. Minimal noise — no charts, no readiness score, no nutrition. Post-run: a "session feedback" sheet (RPE 1-10, "too hard / just right / too easy") that feeds the adapter.

## 5. Onboarding & first-week experience
Funnel: goal (race distance + date OR general fitness) → current ability (recent 5K time OR estimated pace OR "I'm new") → days/week available (3-6) → preferred long-run day → strength yes/no → injury history (basic checkboxes) → paywall. Plan is generated client-perceptibly (animated "building your plan…" with phase callouts). First week is conservative — usually 1 easy + 1 quality + 1 long, even for experienced runners — to calibrate. Free trial 7-14 days, full plan visible during trial.

## 6. Insights / AI layer
The "AI" is mostly **rule-based periodisation + heuristic adaptation**, not an LLM. What it actually adapts on:
- **Pace zones** recalculated from completed workouts (rolling fastest efforts at given distances).
- **Missed sessions** — skipping a run shifts subsequent sessions and reduces the next week's volume by a deload heuristic.
- **Session feedback** — three "too hard" tags in a row drops intensity ~5-10%; three "too easy" raises it.
- **Heart-rate drift** (if connected) — flags easy runs that crept into Z3.
A conversational AI coach chat was added late 2024 (LLM-backed Q&A about the plan) but is shallow vs Pulse's Claude agent — it doesn't reason over cross-sport load or nutrition.

## 7. Retention mechanism
- **Race date as a deadline** — quitting mid-block feels like wasting weeks.
- **Streaks & week-completion rings.**
- **Post-race "what's next?" funnel** — immediately offers next race plan.
- **Push notifications** the night before each session and morning-of.
- **Strava auto-share** with workout structure overlay (post-acquisition this is now native).

## 8. Pricing & business model
Subscription only. ~€19.99/month, ~€119.99/year (regional). 7-14 day free trial. No free tier — locked behind paywall after onboarding preview. No coach marketplace, no hardware, no nutrition upsell. Post-Strava: bundling rumoured but not yet shipped as of early 2026.

## 9. Design language
Clean, white/off-white default with a signature warm coral/orange accent (close to #FF6B4A). Large rounded cards, generous whitespace, friendly sans-serif (Inter-ish). Heavy use of emoji in copy ("Let's go! 🏃"). Tone is encouraging-coach, not data-nerd. Apple Watch complication is minimalist: today's session distance + pace target. Contrast with TrainingPeaks (dense, spreadsheet-like) is intentional.

## 10. What Pulse already does as well or better
- **Cross-sport load view** — Runna is run-only; Pulse merges Hevy gym volume + run TSS + padel/cycle.
- **Hevy integration** — Runna has no real strength tracking (its S&C sessions aren't logged as resistance volume).
- **Readiness signal** — Runna doesn't compute readiness from HRV/sleep; Pulse does via Apple Health.
- **Genuine LLM coach** — Claude with context-assembler + memory + skills can answer "should I move tomorrow's tempo given last night's sleep and yesterday's leg session?" Runna's chatbot can't.
- **Weekly check-in v1.1 + lessons** — qualitative reflection loop with calendar write-back; Runna has no journaling layer.
- **Nutrition** — entirely absent in Runna.

## 11. What Pulse is missing vs Runna for run-coaching specifically
This is the gap to close. Concretely:
1. **Race-anchored periodised plan generator.** Pulse has a training schema, but no "input goal race + date → generate 16-week block with base/build/peak/taper, long-run progression, and cutback weeks." This is Runna's core IP.
2. **Structured interval prescription with pace targets.** Pulse logs Apple Workouts but doesn't *prescribe* "5x1km @ 4:15-4:25, 90s rec." We need a workout primitive (warmup/work/recovery/cooldown blocks with pace or HR targets).
3. **Watch handoff for guided execution.** Runna pushes structured workouts to Garmin/COROS/Apple Watch so the watch beeps interval transitions. Pulse currently has no watch app or structured workout export (.FIT/.zwo).
4. **Pace zone derivation from a recent effort.** No automatic "your 5K PR implies these training paces (easy/marathon/threshold/interval/repetition)" calculation. Jack Daniels VDOT or similar table is missing.
5. **Auto-rebalancing on missed/moved runs.** Pulse's schema is mostly static. Runna's "I missed Tuesday's tempo" → automatic week-rewrite (skip vs shift vs compress) is not in Pulse.
6. **Long-run progression rules.** Distance ceiling per week, cutback every 3-4 weeks, longest-run-as-%-of-weekly-volume — all baked into Runna, none codified in Pulse.
7. **Taper logic.** Volume reduction curves in the final 2-3 weeks pre-race.
8. **Post-session pace-vs-target verdict.** Runna shows "you ran the 4th rep at 4:10, 5s under target — controlled or fade?" Pulse shows the Apple Workout but doesn't grade execution against prescription.
9. **Race predictor.** Updated finish-time prediction from recent training paces and long-run quality.
10. **Strength-as-support framing.** Runna treats S&C as runner-injury-prevention; Pulse treats gym as its own discipline. A "runner mode" view that contextualises gym sessions as load against the run plan is missing.

## 12. What Runna does badly (common complaints)
- **Plan rigidity** — top Reddit complaint. Adjusting one run cascades awkwardly; "easy" runs are often too fast for true Z2; recovery weeks feel arbitrary.
- **Pace zones too aggressive after a single fast 5K** — recalibration overshoots, then users hit a wall on threshold work.
- **No real cross-training accounting** — cycling, swimming, padel, lifting are invisible. Heavy leg day Monday + tempo Tuesday isn't flagged.
- **No HRV/readiness gating** — plan doesn't care if you slept 5h or are sick.
- **Strength sessions are generic** — same bodyweight circuit regardless of phase or equipment.
- **Chat coach is shallow** — can answer "what's a tempo run?" but not reason over your data.
- **Apple Watch app is laggy** and frequently disconnects mid-workout (recurring App Store 1-stars).
- **Nutrition / fueling absent** — no carb targets for long runs or race day.
- **Strava acquisition anxiety** — Reddit threads worry about price hikes, data ownership, and feature dilution under Strava.
- **Subscription-only, no lifetime / one-race option** — friction for users training for a single event.
