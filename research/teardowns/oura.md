# Oura — Teardown
**Researched:** 2026-05-01
**Sources:**
- https://ouraring.com/blog/oura-ring-4/
- https://ouraring.com/blog/oura-advisor/
- https://ouraring.com/blog/readiness-score/
- https://ouraring.com/blog/sleep-score/
- https://ouraring.com/blog/activity-score/
- https://support.ouraring.com/hc/en-us/articles/360025589793-Readiness-Score
- https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
- https://www.businesswire.com/news/home/20250331565896/en/Oura-Advisor-an-AI-powered-Personal-Health-Companion-Now-Rolling-Out-to-All-Oura-Members
- https://www.wareable.com/fitness-trackers/oura-ring-gen-4-review
- https://www.wareable.com/health-and-wellbeing/oura-smart-ring-advisor-ai-health-coaching-feature-announcement
- https://parade.com/health/oura-ring-gen-4-review
- https://overkill.wtf/oura-gen-4-review/
- https://insider.fitt.co/oura-launches-ai-health-coach/
- https://athletechnews.com/oura-introduces-oura-advisor/
- https://www.androidpolice.com/oura-responds-to-safety-concerns-after-reddit-posts-show-burnt-smart-rings/
- https://www.tomsguide.com/wellness/smart-rings/reddit-users-claim-oura-rings-are-overheating-heres-ouras-response
- https://redditrecs.com/fitness-tracker/model/oura-oura-ring-4/
- https://gadgetsandwearables.com/2026/02/11/oura-open-source-app/
- https://www.trustpilot.com/review/ouraring.com

## 1. Snapshot
Oura is the category-defining smart ring + app for sleep, recovery, and "wellness scoring." Gen 4 (Oct 2024) brought a fully titanium body, recessed sensors, ~8-day battery, and Smart Sensing 2.0 (an 18-pathway PPG array) with claimed 120% better SpO2 signal quality and improved accuracy across skin tones. A Ceramic edition launched late 2025, and 2025 also brought metabolic insights via the Dexcom Stelo CGM integration. ~2.5M+ rings sold, valued >$5B. Hardware is sold once (€349–€549); the app is gated behind a $5.99/month membership. The brand is the design-leader in turning messy biosignals into a calm, three-number daily verdict.

## 2. Jobs-to-be-done
- **"Tell me if I'm OK to push today, or should back off."** Single-glance recovery verdict.
- **"Did I actually sleep well?"** Translate sleep stages, HRV, body temp into one trustworthy number.
- **"Notice things I'd miss"** — illness onset (temp deviation), cycle phase, stress load, drift in baselines.
- **"Coach me without me having to be a quant."** Plain-language nudges instead of charts.
- **"Help me build streaks I care about"** — bedtime consistency, daily movement, sleep regularity.

## 3. Killer features (top 3-5)
1. **Three-score system (Sleep / Readiness / Activity)** — the most copied scoring UX in wellness. Each rolls up ~6–9 contributors with personal baselines.
2. **Personal baselines after 14 days** — every contributor is judged vs *your* range, not a population norm. This is the trust engine.
3. **Body temperature deviation** — fingertip skin temp from the ring catches illness, cycle phase, and overtraining 1–2 days early. Genuinely unique to ring form factor.
4. **Oura Advisor (LLM coach, GA Mar 2025)** — chat + proactive nudges grounded in your data, with persistent **Memories**, selectable tone of voice, and "Action Plans" tied to a goal.
5. **Tags / Daytime Stress / Resilience** — lightweight contextual logging that feeds the scoring engine and creates correlation insights ("caffeine after 2pm → -7 sleep score").

## 4. Daily-loop screen
Open app → **Today** view. Top: a single hero number (Readiness, e.g. 84) with one-line verdict ("Pay attention" / "Optimal"). Below: Sleep score card and Activity ring. Then a **horizontally swipeable feed of insight cards** — temp trend, HRV trend, an Advisor nudge, an action-plan check-in, a tag prompt ("How was your stress today?"). Tap any score → detailed contributor breakdown with sparklines vs personal baseline. The loop is intentionally <10 seconds: glance the number, scroll the feed, close. Power-users go to Trends weekly.

## 5. Onboarding & first-week experience
Order ring → free sizing kit → wear daily. App onboarding asks goals (sleep / energy / stress / activity), age/weight/sex, chronotype quiz. Critical UX choice: **scores are deliberately muted for the first 14 days** while baselines calibrate ("Building your baseline — 9 days to go"). Education micro-cards explain each metric the first time it appears. Day 1 shows raw data + a friendly "we don't know you yet" message. By day 14 the experience "switches on" with personalized verdicts — this delayed gratification is a retention masterstroke (sunk cost + reveal moment).

## 6. Insights / AI layer (Oura Advisor)
LLM-backed chat + proactive notifications grounded in the user's biometric history and Memories store. Capabilities:
- **Conversational Q&A** referencing your charts ("Why was my readiness low Tuesday?")
- **Proactive nudges** ("Your deep sleep has dropped 18% over the last 10 days — want to look at what's changed?")
- **Memories** — persistent context (e.g. "recovering from knee surgery", "training for a half marathon") that colors future advice.
- **Tone selector** — Supportive ↔ Goal-oriented.
- **Action Plans** — multi-week goal with daily check-ins.

Example phrasing (verified pattern from Oura's marketing):
> "You're well-recovered. Today's a good day for a strength workout."
> "Consistent meal timing supports metabolic health — want to try eating dinner before 8pm this week?"
> "Heads up: your deep sleep patterns have shifted recently."

The voice is calm, second-person, cause→suggestion, never alarmist.

## 7. Retention mechanism
- **Daily score = daily open.** The hero number is a slot machine for habit-formers.
- **Streaks** (bedtime consistency, activity goal, restorative time).
- **14-day baseline lock-in** front-loads sunk cost.
- **Cycle Insights & illness detection** — moments where the ring "saves" you create evangelism.
- **Membership paywall** — basic scores require active subscription, so churning means losing your history view.
- **Advisor Memories** — the longer you use it, the more personalized it gets, which raises switching cost.

## 8. Pricing & business model
Hardware €349 (Heritage) → €549 (Gold/Ceramic). **Oura Membership $5.99/month or $69.99/year**, required to see Readiness, Sleep, Activity scores, trends, and Advisor. First month free with ring purchase. CGM (Stelo) and Pregnancy Insights are add-ons or partner integrations. Hybrid hardware-+-SaaS, with software now the durable margin engine.

## 9. Design language
Dark, almost monastic. Deep navy/black backgrounds, generous whitespace, single-color accent per score (Readiness purple, Sleep blue, Activity green). Big rounded numbers, serif-ish display font for the hero score, sans for body. Charts are minimal — line, dot, baseline band — no chart-junk. Micro-illustrations (orbs, rings, soft gradients) instead of icons. The whole product feels like a meditation app that happens to do quant. Intentional restraint: at most one CTA per card.

## 10. What Pulse already does as well or better
- **Workload science**: Pulse's acute:chronic ratio with band thresholds is more rigorous than Oura's generic "Activity Balance."
- **Multi-source ingest**: Hevy (per-set, per-exercise), Apple Workouts, Runna, manual nutrition — Oura ignores strength-training depth almost entirely.
- **Coaching memory with decay**: Pulse's decay model is arguably more principled than Advisor's flat Memories store.
- **Weekly Lessons by Claude**: Oura has no weekly retro artifact; Advisor is in-the-moment only.
- **Schema (training plan)**: Oura has no concept of a structured training week.
- **Body composition tracking**: deeper than Oura's current offering.

## 11. What Pulse is missing vs this app  ← gold, be specific
1. **One hero number per day.** Pulse has Readiness but it competes with workload, schedule, nutrition on the home view. Oura's discipline — *one* score, *one* verb ("Pay attention" / "Optimal" / "Restorative") — is the entire UX. Consider a single hero readiness card that owns the top 40% of the screen, with the verbal verdict bigger than the number.
2. **The "14-day baseline" ritual.** Pulse just shows scores from day 1. Stealing Oura's "Building your baseline — N days to go" pattern would set expectations, reduce early-noise complaints, and create a reveal moment.
3. **Contributor breakdown UI.** Tapping a score in Oura shows 6–9 contributors with sparklines vs *your* baseline band. Pulse exposes the inputs but not as a clean drill-down. This is the highest-leverage chart pattern to copy.
4. **Proactive AI nudges (not just on-demand chat).** Advisor pushes "your deep sleep dropped 18% over 10 days" without the user asking. Pulse's coach is reactive. A daily/weekly trigger that runs the context-assembler and pushes 1 insight card to Home would close this gap — leveraging Pulse's existing memory + lessons infrastructure.
5. **Tone-of-voice selector for the AI coach.** Trivial to add (system prompt variant), high perceived personalization. Supportive / Direct / Data-first.
6. **Action Plans = goal-bound multi-week loops.** Pulse has Goals and weekly check-ins but doesn't bind them into a coached arc with daily check-in cards. This is where Memories meet schema.
7. **Tag-style daily annotation.** Lightweight chips ("caffeine late", "alcohol", "stressful day", "travel") that feed the context assembler create longitudinal correlations cheaply. Pulse's check-in is weekly; Oura's is per-day, frictionless.
8. **Restraint in chart density.** Pulse's Trends page is information-rich; Oura's is one chart per screen with a baseline band. Worth A/B-ing a "calm mode."
9. **Streak surfaces** for bedtime consistency / weekly training adherence — Pulse has the data, doesn't celebrate it.
10. **Verbal labels over numbers** in summary contexts ("Optimal", "Pay attention", "Restorative"). Pulse leans numeric.

## 12. What this app does badly (from reviews)
- **Subscription resentment.** Locking *basic* scores behind $5.99/mo after a €349 ring is the #1 r/ouraring complaint; some users are migrating to open-source apps reading the ring directly.
- **Workout tracking is poor.** HIIT sessions log as "zone zero" or fail HR detection; auto-detection misses weight training entirely. Big opening for Pulse.
- **Hardware reliability in 2025**: overheating/burn reports on Reddit (Oura calls them isolated), expanding battery cases, Gen 4 battery degradation 1 year post-launch.
- **Gen 4 was an underwhelming upgrade**: similar size, higher price, few new features beyond sensor-array.
- **Advisor is generic at the edges** — when data is thin or atypical, replies feel like a wellness blog.
- **No real strength-training intelligence**, no nutrition logging, no training-plan structure — Oura is a *recovery* app pretending to be a fitness app.
- **Score anxiety** is a recurring theme in reviews: users report obsessing over a low Readiness number and losing sleep over it. Worth designing *against* in Pulse.
