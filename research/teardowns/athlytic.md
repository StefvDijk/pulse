# Athlytic — Teardown
**Researched:** 2026-05-01
**Sources:**
- https://www.athlytic.app (official site, ECONNREFUSED at fetch time — reverted to athlyticapp.com)
- https://www.athlyticapp.com/
- https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
- https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch
- https://athlytic.github.io/athlyticapp/troubleshooting/
- https://www.corahealth.app/compare/cora-vs-athlytic
- https://www.corahealth.app/blog/whoop-alternative-reddit
- https://www.wareable.com/apple/turn-your-apple-watch-into-whoop
- https://forums.macrumors.com/threads/can-any-explain-to-me-how-athlytic-works.2367500/
- https://www.youtube.com/watch?v=B3k2b4T6Hzw (Athlytic vs Whoop)
- http://chronomac.com/2022/12/16/athlytic-vs-whoop/

## 1. Snapshot
- **Target user:** Apple Watch wearers who want Whoop-style recovery/strain insights without the $20/mo strap subscription. Skews to recreational endurance athletes (runners, cyclists) and HRV-curious quantified-self users.
- **Platform:** iOS + watchOS only (iOS 17+, watchOS 10.6+). No web, no Android.
- **Pricing:** Free tier with basics; Pro $4.99/mo or $29.99/yr; 7-day trial. Family Sharing supported.
- **Maturity:** Live since ~2020, currently v26.4.0, 4.8★ with 10,000+ ratings. Solo-dev (Gary Sabo) but actively shipping; "AI Fitness Coach" rebrand in the App Store name is recent.
- **Data sources:** HealthKit only. Pulls HRV, RHR, sleep stages, SpO2, respiratory rate, wrist temperature, workouts, menstrual cycle. No third-party integrations (no Hevy, Strava, Garmin, MFP).

## 2. Jobs-to-be-done
- "Tell me in one number whether to train hard, train light, or rest today."
- "Give me a Whoop-equivalent recovery + strain loop without buying a strap."
- "Quantify whether last night's sleep was actually restorative."
- "Show me long-term HRV / RHR / VO2 trends so I know if I'm getting fitter or burning out."
- "Nudge me toward a target exertion range that matches today's recovery."

## 3. Killer features
1. **Recovery score (0–100%)** computed overnight from HRV + RHR baselines — the morning-glance number the whole product orbits around.
2. **Exertion score with a dynamic Target Exertion range** that auto-adjusts to today's recovery (Whoop's strain-coach pattern, ported to Apple Watch).
3. **20+ widgets** for iPhone + Apple Watch complications — recovery is one tap from any home screen / watch face.
4. **Sleep scoring** that benchmarks against Oura/Garmin reasonably well, plus auto target-bedtime.
5. **Women's cycle phase coaching** — recovery interpretation tied to menstrual phase (rare in this category).
6. **Workout deep-dive**: HR zones, route map, mile splits, auto-lap haptics, "training effect" label per session.

## 4. Daily-loop screen
Morning-open screen is a four-tile dashboard:
1. **Recovery %** (big circular gauge, color-coded green/yellow/red)
2. **Exertion** (current vs. target range bar)
3. **Sleep score** with hours + stages
4. **Energy Burned** (active + resting kcal)

Below: a one-line text suggestion ("aim for an exertion of 8–12 today") and trend sparklines for HRV/RHR. Tapping any tile drills into history + contributing inputs.

## 5. Onboarding & first-week
- Sign-in is local (no account); HealthKit permission prompt is the first screen.
- Asks for sex, DOB, height/weight for baselines.
- **Cold-start problem:** Recovery requires ~7 nights of HRV history before scores stabilize; the app shows provisional numbers with a "still learning" disclaimer. Reviews frequently cite the first week as "looks broken" until baselines settle.
- No goals onboarding, no plan selection, no equipment / training-history questionnaire.
- Push notifications: morning recovery, evening sleep target, weekly summary.

## 6. Insights / AI layer
- **Rules-based, not LLM.** Despite the App Store rename to "AI Fitness Coach," the insights are deterministic thresholds over HRV/RHR/sleep deltas vs a rolling 30/60-day baseline.
- Phrasing examples: "Recovery is 38% — significantly below your baseline. Consider an easy day or rest." / "Your HRV has trended down for 4 days; sleep more or reduce intensity." / "Target exertion: 8–12. Last 7 days avg: 14."
- No conversational chat. No memory of user goals, injuries, or prior advice. No reasoning about *why* recovery is low (didn't correlate alcohol, late-meal, travel, lifting volume).
- "Coaching" is essentially smart copy on top of a bucketed score.

## 7. Retention mechanism
- **Morning ritual hook**: the recovery number is the lockscreen widget — opening to check it is a daily habit by week 2.
- **Streaks of compliance**: hitting target exertion range counts toward a weekly bar.
- **Trend pages** (HRV, VO2max, sleep debt over 30/90/365d) reward long-tenure users — leaving means losing your history.
- Push at ~7am and ~10pm.

## 8. Pricing & business model
- Freemium → subscription. Free shows recovery & sleep but caps trends at 7 days and locks Exertion targets, women's cycle, advanced workout views.
- Pro: $4.99/mo or $29.99/yr (~50% discount annual). 7-day trial.
- No hardware, no coaching upsell, no marketplace. Pure SaaS-on-HealthKit.
- Positioned explicitly as "Whoop without the $239/yr strap."

## 9. Design language
Dark, dense, gauge-and-ring heavy iOS-native look — closer to Apple Fitness + Whoop than Strava. Heavy use of circular progress, colored tiles, SF Pro, with a teal/green accent. Information-dense to the point reviewers call the GUI "overloaded."

## 10. What Pulse already does as well or better
- **Multi-source ingest**: Pulse already merges Hevy (sets/reps/load), Apple Health, Apple Workouts, Runna, manual nutrition + check-in. Athlytic is HealthKit-only, so it is blind to gym volume, macros, subjective wellness, and external programs.
- **Acute:chronic workload ratio** with muscle-group resolution — Athlytic only has a single cardiac "exertion" score and is explicitly criticized for ignoring muscular fatigue (older-athlete review notes overtraining risk).
- **Real LLM coach** with context assembler + memory + decay vs Athlytic's hardcoded threshold copy.
- **Weekly check-in v1.1** with structured reflection → Claude-extracted lessons. Athlytic has nothing equivalent; it never asks the user how they feel.
- **Schema/program scheduling with Google Calendar write** — Athlytic has zero planning surface.
- **Body composition + baselines + nutrition** — out of scope for Athlytic entirely.
- **Web/desktop**: Pulse is responsive web; Athlytic users with no Apple Watch are locked out.

## 11. What Pulse is missing vs Athlytic (most important)
- **A single morning-glance "should I train hard today?" number.** Pulse has readiness, but not surfaced as the one-tile-everyone-checks ritual the way Athlytic's recovery ring is. Make readiness the lockscreen-equivalent hero.
- **iOS lockscreen / home-screen widgets and watchOS complications.** This is Athlytic's #1 retention mechanism; Pulse currently has none. Even a simple PWA install + a dedicated mobile route showing readiness + today's plan would close most of the gap.
- **Target exertion range that auto-adapts to readiness.** Pulse has acute:chronic and can compute it, but doesn't *prescribe* "stay in this band today" as a visible UI element.
- **Push notifications on the morning ritual** (~7am readiness + plan; ~10pm sleep target). Pulse has the data but no notification layer.
- **Cardiac load tracking 24/7** (cardio strain accumulation throughout the day, not just per-workout) — Athlytic shows it as a live ticker. Pulse aggregates per-day; live intra-day rolling cardio load is missing.
- **Sleep scoring with target bedtime suggestions.** Pulse has sleep data but no composite score and no bedtime nudge.
- **Trend pages with proper time-window pickers (30/90/365)** for HRV, RHR, VO2max, sleep debt. Pulse trends exist but Athlytic's are more polished and the "leaving = losing history" lock-in is real.
- **Wrist temperature, SpO2, respiratory rate baselines** — Pulse ingests these but doesn't surface anomaly detection (e.g., "temp +0.4°C, possible illness, deload").
- **Women's cycle-aware recovery interpretation** — Pulse has no cycle model.
- **Onboarding cold-start communication.** Athlytic explicitly says "still learning" for ~7 nights. Pulse should manage expectations the same way.
- **Workout route map + HR zone overlay + auto-lap mile splits** for runs. Runna covers some of this but Pulse doesn't replay runs richly.
- **App Store distribution.** Pulse is a personal web app; Athlytic has SEO + 10k reviews + App Store search surface. Not a feature gap, but a moat gap if Pulse ever wants users.

## 12. What Athlytic does badly (anti-patterns to avoid)
- **"AI Fitness Coach" branding without an actual LLM.** Reviews increasingly call this out. If Pulse ships AI claims, back them with conversational reasoning, not threshold copy.
- **Cardio-only recovery model** ignores lifting/muscular fatigue → reviewers report it greenlights training when legs are wrecked. Pulse's per-muscle-group acute:chronic must stay a first-class citizen.
- **Generic, non-actionable suggestions** ("aim for exertion 8–12") without telling the user *what activity* or *intensity* — substack reviewer flagged this. Pulse's coach should prescribe concrete sessions tied to the schema.
- **Widget/stat freshness bugs** ("widget rarely updates", "HRV from middle of the day") and the official troubleshooting page literally recommends "force-close, reboot, reinstall." Pulse should invest in observable freshness (last-synced timestamp, manual resync button).
- **Sleep score ceiling-bias** — reviewers report constant 100% scores making the metric meaningless. Pulse's scores need calibration so the top of the range is rare.
- **GUI overload** — multiple Reddit threads call it cluttered. Pulse should resist tile-creep on the home screen; the design system v2 single-hero pattern is the right answer.
- **No subjective input loop.** App never asks "how do you feel?" so the model can't correct itself. Pulse's weekly check-in + memory layer is the differentiator — lean into it.
- **No goal awareness.** Athlytic doesn't know if you're peaking for a marathon or cutting weight; advice is identical for everyone. Pulse's program/schema context must flow into every coach response.
- **HealthKit-only lock-in** means no gym volume, no nutrition, no external plan — entire categories of overtraining causes are invisible. Pulse's multi-source ingest is the structural advantage; protect it.
- **No web/no export** — your data lives in one iPhone forever. Pulse being web-first + Supabase-backed is a real trust advantage.
