# Whoop — Teardown
**Researched:** 2026-05-01
**Sources:**
- https://www.whoop.com
- https://www.whoop.com/us/en/thelocker/introducing-whoop-coach-powered-by-openai/
- https://www.whoop.com/us/en/thelocker/the-whoop-journal/
- https://support.whoop.com/s/article/WHOOP-Journal-Overview
- https://support.whoop.com/s/article/Viewing-Trends
- https://www.wareable.com/wearable-tech/whoop-5-review
- https://www.wareable.com/fitness-trackers/whoop-coach-ai-strength-trainer-workout-builder-update
- https://the5krunner.com/2025/10/31/2026-whoop-5-0-mg-review-discount-accuracy-strain-recovery-athletes/
- https://the5krunner.com/2026/02/28/new-whoop-strength-trainer-update/
- https://cybernews.com/health-tech/whoop-review/
- https://medium.com/design-bootcamp/whoop-vs-apple-watch-vs-oura-the-health-app-war-is-no-longer-about-the-hardware-18b5b3c84a3b
- https://askvora.com/blog/whoop-vs-oura-ring-2026
- https://mattressmiracle.ca/blogs/mattress-miracle-blog/oura-ring-4-whoop-5-0-apple-watch-sleep-tracker-2026
- https://www.techradar.com/health-fitness/users-of-the-new-whoop-mg-fitness-band-are-reporting-widespread-failures
- https://www.techradar.com/health-fitness/fitness-trackers/whoop-has-broken-a-promise-on-free-hardware-upgrades-and-users-arent-pleased
- https://www.community.whoop.com/t/what-are-all-the-complaints-about/7703
- https://www.trustpilot.com/review/whoop.com
- https://everydayindustries.com/whoop-wearable-health-fitness-user-experience-evaluation/
- https://gadgetsandwearables.com/2026/02/22/whoop-ai-beta/

## 1. Snapshot
- **Target user:** Serious recreational athletes, biohackers, and pro athletes (Ronaldo, Mahomes, Sabalenka are brand faces). Prosumer fitness rather than mainstream wellness.
- **Platform:** Proprietary screen-free band (Whoop 5.0 / MG) + iOS/Android app. No standalone smartwatch features, no on-device GPS.
- **Pricing:** Subscription only — ONE €199/yr, PEAK €264/yr, LIFE €399/yr. Hardware "free" with membership; 12-month lock-in. ~$30/mo equivalent.
- **Maturity:** Founded 2012, Whoop 5.0 launched 2025, Whoop Coach (OpenAI-powered) launched late 2023, AI Beta program Q1 2026.
- **Data sources:** Continuous PPG HR/HRV, SpO2, skin temp, accelerometer, ECG (LIFE tier), blood pressure cuff sync (LIFE), user journal (300+ behaviors), Strava/Apple Health import, manual workouts.

## 2. Jobs-to-be-done
- "Tell me how hard I can train today without breaking myself."
- "Score how well I slept and what behaviour caused it."
- "Quantify my training load over weeks/months so I see fitness trending up."
- "Flag a health anomaly (low HRV, elevated RHR, irregular rhythm) before I feel it."
- "Coach me in plain language without me having to read charts."

## 3. Killer features
1. **Recovery score (0-100%)** — single morning number combining HRV, RHR, sleep, respiratory rate. The whole product hangs off this one ritual.
2. **Strain score (0-21, Borg-derived, log scale)** — cardio + (now) strength training Strain Trainer that auto-credits lifting volume against your recovery.
3. **Sleep Performance & Sleep Coach** — needed-vs-got sleep with a recommended bedtime that updates daily based on tomorrow's strain target.
4. **Whoop Journal** — opt-in to ~300 behaviours (caffeine, alcohol, screen time, magnesium, sex, stress…); the engine then surfaces *Monthly Performance Assessment* correlations like "alcohol dropped your recovery 21% on average."
5. **Whoop Coach (OpenAI LLM)** — chat that answers "Why is my recovery low?" with reference to *your* numbers, can build a Strength Trainer workout from a screenshot, and proactively pings insights.

## 4. Daily-loop screen
Open app → **Overview/Today**: a stacked card view with three rings/numbers — Recovery % (color-coded green/yellow/red), Sleep Performance %, day's Strain (live, climbing as you move). Below: today's recommended Strain target, a Coach nudge ("You're in the green — push for 14.5 today"), and the morning Journal prompt. Tab bar: Overview / Coach / Strength Trainer / Health / More. Tapping any ring drills into a "why" view (sleep stages, HRV trend last 14 days, strain breakdown by activity).

## 5. Onboarding & first-week experience
Profile setup (age, sex, height, weight, goals: fitness/health/sleep/stress). Then explicit education modals on what Strain, Recovery and Sleep mean and that "scores are only relative to YOU." First 4 days = baseline-building period where scores are shown but flagged as preliminary. Daily morning prompt to fill Journal; first weekly Performance Assessment lands on day 7 with "here's what we already learned about you." Effective hook: every morning has a tiny dopamine moment (the Recovery reveal).

## 6. Insights / AI layer (with example phrasing)
- **Monthly Performance Assessment**: "In April, days when you logged ≥2 alcoholic drinks had a 21% lower Recovery the next morning compared to alcohol-free days." Ranked list of behaviour→outcome correlations.
- **Whoop Coach prompts:** "Why is my recovery low this morning?" → "Your HRV dropped to 38ms (baseline 54), RHR up 6bpm, and you got only 1h22 of REM. The padel session yesterday hit 16.4 Strain — your highest in 11 days. Take a low-Strain day, target ≤8."
- **Proactive nudges:** "Your sleep need tonight is 8h12 to fully recover for tomorrow's planned run. Aim to be in bed by 22:48."
- **Workout from screenshot:** snap an Instagram lifting routine → parsed into sets/reps in Strength Trainer, auto-adjusted to today's recovery.

## 7. Retention mechanism
The morning Recovery reveal is a Pavlovian habit — users open the app within minutes of waking. The 12-month locked-in subscription removes opt-out friction. Weekly + Monthly Performance Assessments give a longer-form "story" beat. Streaks on journal logging. Community challenges and team comparisons (gym groups, military units). The band has no screen, so the app is the only surface — every interaction with your data routes through Whoop.

## 8. Pricing & business model
Pure subscription (€199-€399/yr). Band is bundled, replaced free at major upgrades (LIFE only, after 2025 backlash). No à-la-carte hardware. Add-ons: Whoop Body apparel (sensor pockets), LeatherLuxe bands. Effective ARPU ~€20-33/mo, very high LTV due to lock-in. Margins favour software; hardware is loss-leader.

## 9. Design language
Minimalist near-black UI, bold sans-serif numerics, traffic-light recovery semantics (green/yellow/red) as the dominant visual signal; cards are flat, content-dense, and chart-forward — feels closer to a Bloomberg terminal for your body than a wellness app.

## 10. What Pulse already does as well or better
- **Multi-source ingestion**: Pulse merges Hevy + Apple Workouts + Runna + manual nutrition; Whoop is single-source (its own band) and only recently opened to imports.
- **Strength training intelligence**: Pulse has set-level Hevy data from day one; Whoop's Strength Trainer is brand new and approximate.
- **Acute:chronic workload ratio**: Pulse's ACWR is more rigorous and sport-specific (gym/run/padel/cycle) than Whoop's single Strain bucket.
- **Schema scheduling with Google Calendar write-back**: Whoop has no calendar integration, no schema concept.
- **Coaching memory**: Pulse's memory layer persists user context across chats; Whoop Coach context is shallower per session.
- **Nutrition + body composition**: Whoop has zero nutrition tracking; Pulse has manual nutrition + body comp baselines.
- **Weekly check-in conversation**: Pulse's interactive check-in is richer than Whoop's auto-generated weekly assessment.

## 11. What Pulse is missing vs Whoop (UX / insight patterns to steal)
1. **The single-number morning ritual.** Whoop's Recovery % owns the morning. Pulse has Readiness but it's not yet the *centerpiece* of a "wake up → open app → see one number → know your day" loop. Make Readiness the hero, color-coded green/yellow/red, push-notified at wake time, with a one-line Coach verdict underneath.
2. **Recommended Strain target for the day.** Whoop tells you "shoot for 12-14 today." Pulse should output a daily training-load target (intensity band per sport) derived from ACWR + readiness, not just a status.
3. **Recommended bedtime that updates daily.** "Be in bed by 22:48 to be ready for tomorrow's run" — derived from sleep-need + tomorrow's planned schema session. Pulse already has the schema; it's the missing math.
4. **Journal → behaviour-correlation engine.** Whoop's killer is "alcohol = -21% recovery for you specifically." Pulse logs check-ins and nutrition; we should run weekly correlations between logged behaviours (alcohol, late meals, screen time, stress rating) and next-day readiness/HRV/sleep. Output ranked list in the weekly lesson.
5. **Monthly Performance Assessment as a long-form artifact.** A shareable, narrative monthly report ("April: your aerobic base grew, your sleep consistency dropped, here are the 3 behaviours that hurt you most"). Pulse has weekly lessons but no monthly cadence.
6. **Proactive Coach pings, not just on-demand chat.** Whoop Coach surfaces insights without the user asking ("Your HRV has trended down 4 days in a row"). Pulse's Claude coach is reactive; add a daily/weekly cron that detects pattern shifts and pushes a notification + chat seed.
7. **"Why?" drill-down everywhere.** Every Whoop number is tappable to "why is this what it is?" with attribution to sub-signals. Pulse's cards should universally support a "why this number" expansion that shows the inputs.
8. **Build-workout-from-screenshot.** Whoop's parse-an-Instagram-routine flow is delightful and uses Claude's vision capabilities natively — Pulse could ship this for Hevy routine creation in a week.
9. **Sleep-need vs sleep-got framing.** Pulse shows sleep duration; Whoop shows it as a deficit/surplus against a personalised need that itself adjusts to yesterday's strain. More actionable.
10. **Onboarding education modals.** Whoop teaches users *how to read their own scores* before showing them. Pulse drops people into a dashboard cold — add a 3-screen "what these numbers mean for you" intro.
11. **Streaks on check-in / journal.** Lightweight gamification that Pulse currently lacks for the daily check-in.

## 12. What Whoop does badly (from reviews)
- **Subscription lock-in & cancellation hell.** Trustpilot/Reddit are full of users charged hundreds for months they didn't realise were locked in; "Monthly commitment" wording is misleading.
- **Hardware reliability of MG.** Widespread reports of MG units bricking within 24h, LEDs dying, sync failures (TechRadar).
- **GPS dependency on phone.** No on-board GPS; running pace/distance off by ~0.2 mi; runners forced to wear a second device.
- **Step tracking on bicep is poor.** Wrist-to-bicep band placement breaks step accuracy.
- **HR drops out in HIIT.** Wrist-PPG falters during high-intensity intervals — a known gap for a product that sells itself on Strain accuracy.
- **No screen / no notifications.** Pure data device; users wanting any smartwatch utility are disappointed.
- **No nutrition or food logging.** Major blind spot for a "performance" platform.
- **Free upgrade promise broken.** 2025 backlash when 4.0 owners weren't auto-upgraded to 5.0; partial reversal only after Reddit revolt.
- **Coach can hallucinate / be generic.** Some reviewers note Whoop Coach reverts to safe, vague advice when data is sparse.
- **Slow customer support.** Consistently flagged across Trustpilot reviews.
