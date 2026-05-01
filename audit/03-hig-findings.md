# Pulse — Apple HIG Audit (2026 Liquid Glass + Accessibility)

**Auditor:** general-purpose agent (Opus 4.7)
**Date:** 2026-05-01
**Scope:** Home, Check-in, Chat, Schema, Progress, Workout detail, Nutrition, Settings + Onboarding, Auth, Navigation cross-cutting.
**Theme:** dark-only. Tokens: `src/app/globals.css` + `design/design_handoff_pulse_v2/`.

Bottom line: navigation/safe-area handling is solid and the Apple type tokens exist, but they are bypassed by hard-coded pixel sizes in nearly every screen, and dozens of interactive elements are below the 44pt minimum. Reduced-motion compliance is partial: only the CoachOrb and root view-transition honour it; every Recharts chart, every motion/react variant, every `animate-spin` and `animate-pulse`, plus the `TimeOfDayTheme` 1500ms fade ignore the user preference.

Severity legend: **P0** = HIG blocker (a11y / target size / safe area), **P1** = clarity/deference issue, **P2** = polish.

---

## 1. Home (`src/app/page.tsx`, `src/components/dashboard/DashboardPage.tsx`, `src/components/home/*`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| DashboardPage.tsx:67,216 | Vertical padding `pt-16` (64px) — duplicates layout's `pt--ARB-env(safe-area-inset-top)-` and bakes in dynamic-island avoidance with a fixed value. | Use a single source of truth: rely on layout safe-area or `pt-[max(env(safe-area-inset-top),60px)]`. Currently iPhone 14 Pro+ users get extra 50px of dead space. | Deference | P1 |
| DashboardPage.tsx:84-88,86-87,98-104,108-114,115,120-132,148-150,224,250 | Hard-coded `text-[28px]`, `text-[44px]`, `text-[24px]`, `text-[20px]`, `text-[11px]`, `text-[13px]`, `text-[18px]`, `tracking-[-1.2px]`, `leading-none`. | Use `text-large-title` / `text-title1` / `text-title2` / `text-headline` / `text-caption2` tokens. The whole point of defining the Apple type scale in globals.css is undermined here. | Clarity | P1 |
| DashboardPage.tsx:122-125 | Primary CTA "Start workout" `h-12` — 48px, OK; secondary chevron button `h-12 w-12` with single `›` glyph at 18px. | OK on size; but `›` U+203A is non-semantic. Use `<ChevronRight />` icon for screen readers + Liquid Glass clarity. `aria-label="Detail"` is too vague. | Clarity | P2 |
| DashboardPage.tsx:159-170 | Week-strip day dot 36×36 (`h-9 w-9`) is below 44pt though parent is a passive `<div>`. If meant to be tappable (per typical pattern) it must be a button. | If non-interactive, fine. If linkable to that day, wrap in `Link` with min 44pt hit area (e.g. invisible padding via `before:absolute -inset-…`). | Accessibility | P1 |
| DashboardPage.tsx:215-220 | `motion.div` list-stagger animation runs unconditionally on every Home mount. | Honour `prefers-reduced-motion` via `useReducedMotion()` and disable variants. | Motion | P0 |
| DashboardPage.tsx:230 | `<CoachOrb size={32} />` wrapped in bare `<Link>` — total tap target 32px. | Wrap with min 44×44pt `Link` (padding) or set `size={32}` inside a 44pt frame. | Accessibility | P0 |
| HomeHero.tsx:106 | Hero number uses `clamp(44px,12vw,72px)`. On iPhone SE viewport (320px) this resolves to ~44px — ok; but `lineHeight: 1.02` clips descenders for "@". | Use `leading-tight` or 1.05 minimum; clamp lower bound 40px to match `text-large-title`. | Clarity | P2 |
| HomeHero.tsx:94-97 | Whole hero is one `<Link>` with text + CoachOrb — VoiceOver reads it as a single blob. | `aria-label` should announce "Vandaag, <metric>, open schema"; current label = entire concatenated text. | Accessibility | P2 |
| CheckInBadge.tsx:37-47 | Card padding `p-4`, content height ≈ 56px. Hit target OK. Color `#0A84FF/10` over `#15171F` keeps body text contrast on `#F5F5F7` — fine. Subtitle `text-caption1` (12px). | OK. | — | — |
| DailyHealthBar.tsx:39 | `text-subhead` (15px) for stat values, `text-caption2` (11px) for label — 4-column grid; on 320px width each column is ~70px, label "Slaap" wraps risk acceptable but no test. | Add `min-w-0` and consider `text-caption1` for label to match Apple secondary metric. | Clarity | P2 |
| DailyHealthBar.tsx:128-143 | "Weight" line is interactive-looking but unclickable; `text-caption1` on a `text-text-tertiary` background → contrast ≈3:1, **below 4.5:1**. | Lift to `text-text-secondary` or remove. | Accessibility / Clarity | P0 |
| ReadinessSignal.tsx:86-92 | SVG ring uses `transition: stroke-dashoffset 600ms ease-out` inline — does not honour reduced-motion. | Wrap in `@media (prefers-reduced-motion)` or set duration 0. | Motion | P0 |
| ReadinessSignal.tsx:202-206 | ACWR drilldown `<Link>` with no padding around 12px text → ~16px hit area. | Min 44pt with extra padding. | Accessibility | P0 |
| SyncButton.tsx:66-81 | Button height `py-2 + caption1` ≈ 28px. | Min 44×44pt. | Accessibility | P0 |
| SyncButton.tsx:89-96 | Info button 24×24 (`h-6 w-6`). | Min 44pt; current is gravely small. | Accessibility | P0 |
| TodayWorkoutCard.tsx:122-145 | `Card padding="lg"` then status pill `text-caption1` (12px), white-on-white-tint pill = ok. Card itself is non-clickable but visually CTA-like. | If meant to navigate, wrap in Link. Otherwise reduce visual prominence (smaller corner radius / lower elevation) so user doesn't tap. | Clarity | P1 |
| PulseTriad.tsx:85 | `transition: stroke-dashoffset 600ms ease-out` ignores reduced-motion. | Same fix as Readiness. | Motion | P0 |
| WeekAtAGlance.tsx:80-91 | Status indicator 32×32 (`h-8 w-8`). If interactive (DayPill is currently a passive div), it shouldn't be tappable. The visual call-to-action is high though. | If clickable in future, raise to 44pt; clarify intent now. | Accessibility | P2 |
| WeekAtAGlance.tsx:38-46 | Padel uses `--color-status-warn` (orange) — same as run. Two sports indistinguishable. | Use design token `--color-sport-padel-base` (#FFB020 vs run `#FF5E3A`). | Clarity | P1 |
| ActivityCard.tsx:83-98 | Title `text-base` + caption `text-xs` — uses Tailwind defaults instead of Apple tokens. | `text-headline` / `text-caption1`. | Clarity | P2 |
| ActivityCard.tsx:152-163 | `MuscleGroupDot size="sm"` 28×28 inside a list row — non-interactive, OK; but row itself has 8px vertical padding making target tiny if linkified later. | Document non-interactive. | Clarity | P2 |
| ActivityFeed.tsx:68-76 + WorkoutFeed.tsx:68-76 | Sync button `py-1.5` ≈ 28px tall. | Min 44pt or move to icon-only with proper hit area. | Accessibility | P0 |
| WorkoutFeedCard.tsx:73-87 | Headline `text-base`, caption `text-xs`. | Use Apple tokens (headline/caption1). | Clarity | P2 |
| MuscleGroupDot.tsx:5-19 | Uses Tailwind `bg-red-500/20`, `bg-blue-500/20` etc — bypasses design tokens entirely; "rotator" / "rug"/"borst" labels not consistent with sport-base palette. | Map to `--color-sport-*` or sport-derived palette. | Clarity | P2 |
| BodyCompositionCard.tsx:144-148 | `<div className="bg-orange-400/80">` — Tailwind orange instead of `--color-status-warn`. | Use token. | Clarity | P2 |
| ReadinessSignal.tsx (whole), TodayWorkoutCard.tsx, BodyCompositionCard.tsx, WeekAtAGlance.tsx | Mix of `text-headline`, `text-subhead` (Apple tokens) and raw `text-base`, `text-sm`, `text-xs` (Tailwind defaults). | Pick one system per file; Apple tokens are canonical. | Clarity | P1 |

**Tally Home — P0: 6 · P1: 6 · P2: 9**

---

## 2. Check-in (`src/app/check-in/page.tsx`, `src/components/check-in/*`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| CheckInFlow.tsx:195,229,244 | `pt-[60px]` / `pt-[80px]` — magic safe-area replacements. | Use `pt-[max(env(safe-area-inset-top),60px)]`. | Deference | P1 |
| CheckInFlow.tsx:77 | Step indicator pip `h-6 w-6` — passive but visually a button-like dot. OK as non-interactive. | Document; fine. | — | P2 |
| CheckInFlow.tsx:202-208 | Heading `text-[28px] font-bold tracking-[-0.6px]` — bypasses `text-title1`. | Apple token. | Clarity | P1 |
| CheckInFlow.tsx:231-242,233 | "Terug" link `text-[17px]` — height ≈ 28-30px (no padding). | Wrap in `min-h-[44px]` parent or add `py-2`. Apple back button is 44pt. | Accessibility | P0 |
| CheckInFlow.tsx:251-263 | Test-mode checkbox row — native `<input type="checkbox">` is ~16×16 and the row uses `py-2`. | Native checkbox is 16pt; expand label area to 44pt or use a switch. | Accessibility | P0 |
| PlanChat.tsx:170-177 | Send button 32×32 (`h-8 w-8`). | 44×44 minimum, especially in chat-like UX. | Accessibility | P0 |
| PlanChat.tsx:139-150 | Quick chips `py-1` ≈ 22px tall. | Min 44pt. | Accessibility | P0 |
| PlanChat.tsx:121,128 | User chat bubble `bg-[#0A84FF]` literal hex; assistant bubble border. | Use `--color-system-blue` token. | Clarity | P2 |
| ManualAddModal.tsx:266-272 | Modal backdrop `bg-black/30 backdrop-blur-sm` → relatively translucent; on dark page this is barely a backdrop. | `bg-black/50` minimum for clear scrim, or use `glass` utility for true Liquid Glass. | Depth | P1 |
| ManualAddModal.tsx:282-287 | Close button 32×32 (`h-8 w-8`). | 44pt. | Accessibility | P0 |
| ManualAddModal.tsx:266 | `fixed inset-0 z-50` — modal does not respect safe-area-inset-bottom on devices with home indicator (sliding sheet is bottom-anchored). | Add `pb--ARB-env(safe-area-inset-bottom)-`. | Safe area | P0 |
| ManualAddModal.tsx — modal mount | No `prefers-reduced-motion` check; modal slide-in is implicit via `items-end` + `rounded-t-3xl` (no animation). | OK. | — | — |
| ManualAddModal.tsx:87-93,205-211,247-253 | Form CTA `py-2.5` ≈ 38px. | 44pt minimum. | Accessibility | P0 |
| WeekPlanCard.tsx:300-304 | Each session card has 3 buttons (`h-7 w-7`) for edit/remove/expand. | All 28px → bump to 44pt; or convert to swipe-to-delete + tap-to-edit. | Accessibility | P0 |
| WeekPlanCard.tsx:341-348 | "+ Extra sessie" pill `py-1` ≈ 22px. | 44pt. | Accessibility | P0 |
| WeekPlanCard.tsx:354-360 | Per-day "Geen training" + 24×24 plus button. | 44pt. | Accessibility | P0 |
| WeekPlanCard.tsx:494-503 | Loading state `Loader2 animate-spin` — does not honour reduced-motion. | `motion-reduce:animate-none` on every spinner site (≥ 12 occurrences across the app). | Motion | P0 |
| WeekPlanCard.tsx:636-649 | Native checkbox for calendar sync — same target-size issue. | Use a Switch or lift to 44pt. | Accessibility | P1 |
| WeekPlanCard.tsx:652-657 | Primary CTA `py-2.5` ≈ 38px. | Min 44pt; this is the flow's confirm button. | Accessibility | P0 |
| WeekPlanCard.tsx:282-289 | Day-row `<div>` is whole-row tappable in pattern but only buttons inside are interactive. Inconsistent with iOS list pattern (whole-row should be tappable). | Either lift the row to a button or remove pseudo-affordance. | Clarity | P1 |
| VitalsCard.tsx:60-83 | Spark bar uses 8×8 colored bars over text-tertiary; bar values without numeric labels — relies entirely on color. | Add tooltip or always-visible value for top day. | Clarity | P2 |
| VitalsCard.tsx:154,156 | Hard-coded `text-[15px]`, `text-[10px]` — bypass tokens. | `text-subhead`, `text-caption2`. | Clarity | P2 |

**Tally Check-in — P0: 11 · P1: 4 · P2: 4**

---

## 3. Chat (`src/app/chat/page.tsx`, `src/components/chat/*`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| ChatPage.tsx:19 | `h-[calc(100dvh-86px)]` — hardcodes nav-bar height. Breaks on landscape iPad. | Use `flex-1 min-h-0` inside layout's `<main>` and let it size naturally. | Clarity | P1 |
| ChatPage.tsx:22 | Header `pt-[60px]` magic; gradient is `linear-gradient(180deg, rgba(124,58,237,0.10), transparent)` — purple is off-brand for coach (brand = coral). | `pt-[max(env(safe-area-inset-top),60px)]`; align coach hero with `--color-brand-claude`. | Deference / Brand | P1 |
| ChatPage.tsx:38-43 | "Nieuwe sessie" button `py-1.5` ≈ 28px — small touch target, key action. | 44pt. | Accessibility | P0 |
| ChatInterface.tsx:343-350 | Streaming reveal driven by rAF — runs continuously; no reduced-motion fallback. | If reduce-motion, skip smoothing, render full text. | Motion | P1 |
| ChatInput.tsx:39-42 | `min-h-[44px]` ✓ — meets Apple minimum, good. | — | — | — |
| ChatInput.tsx:56-61 | Send button `h-9 w-9` = 36px. | Min 44pt. (Tap target inside larger input still valid only if hit area extends to parent — it doesn't here.) | Accessibility | P0 |
| ChatInput.tsx:39 | Input bar has no safe-area padding; covers home indicator on iOS PWA. | `pb--ARB-env(safe-area-inset-bottom)-` on the wrapper or on `<main>`. | Safe area | P0 |
| ChatInput.tsx:62-66 | Loading spinner pure CSS `animate-spin` — no reduce-motion variant. | Add `motion-reduce:animate-none`. | Motion | P1 |
| ChatMessage.tsx:75 | `max-w-[85%]` — fine; `text-subhead` (15px) inside; bubble corner radius 16/4 = good iMessage-like asymmetry. | — | — | — |
| ChatMessage.tsx:77 | User bubble `bg-[#0A84FF]` literal. | Use system-blue token. | Clarity | P2 |
| MiniChat.tsx:24,28 | FAB at `fixed bottom-24 right-4` overlaps nav (86px) on mobile + has no safe-area-inset-bottom; popup is `h-[420px]` regardless of viewport. | `bottom-[calc(86px+env(safe-area-inset-bottom)+8px)]`; height `min(420px, 70vh)`. | Safe area | P0 |
| MiniChat.tsx:62-68 | FAB 48×48 ✓; popup close button `p-0.5` size 14 — total ≈18×18px. | 44pt. | Accessibility | P0 |
| MiniChat.tsx:36-43 | "Open volledig" link tiny `text-xs` — hit area ≈ 30×16. | 44pt or remove. | Accessibility | P0 |
| MiniChat.tsx:13-21 | Outside-click closes popup; no Escape-key handler. | Add `keydown` Escape close. | Accessibility | P1 |
| MiniChat.tsx:62-68 | FAB has `transition-transform hover:scale-105` — desktop OK, but ignores reduced-motion. | `motion-reduce:transform-none`. | Motion | P2 |
| ChatInterface.tsx — error toasts as bubbles | Errors are inserted as assistant messages — accessibility-wise screen reader cannot distinguish. | Use ARIA live region or distinct error role. | Accessibility | P1 |

**Tally Chat — P0: 5 · P1: 4 · P2: 2**

---

## 4. Schema (`src/app/schema/page.tsx`, `src/components/schema/*`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| SchemaPageContent.tsx:104,107 | `pt-[60px]`, `text-[28px] font-bold tracking-[-0.6px]`. | Safe-area max + `text-title1`. | Clarity | P1 |
| SchemaWeekView.tsx:99-104 | "Plan in agenda" button `py-1.5 text-xs` ≈ 28px. | 44pt. | Accessibility | P0 |
| SchemaWeekView.tsx:106-112 | "Koppel agenda" plain `<a>` underlined link, ~14×30px. | 44pt. | Accessibility | P0 |
| DayDetailSheet.tsx:74-79 | Close button 28×28 (`h-7 w-7`). | 44pt. | Accessibility | P0 |
| DayDetailSheet.tsx:59-61 | Modal `bg-black/20 backdrop-blur-sm` — too light a scrim; legibility on dark theme suffers. | `bg-black/45+`. | Depth | P1 |
| DayDetailSheet.tsx — sheet | No safe-area padding on bottom-sheet variant `items-end`. | `pb--ARB-env(safe-area-inset-bottom)-`. | Safe area | P0 |
| PlanWeekModal.tsx:102-107 | Close button 32×32. | 44pt. | Accessibility | P0 |
| PlanWeekModal.tsx:140-146 | Native checkbox + label, target ≈ 16pt. | Switch or lift to 44pt. | Accessibility | P0 |
| PlanWeekModal.tsx:160-174 | Time `<input type="time">` with `py-1` ≈ 22px tall on iOS Safari. | 44pt. | Accessibility | P0 |
| PlanWeekModal.tsx:191-202 | Sticky footer "Toevoegen aan agenda" `py-2.5` ≈ 38px. | 44pt. | Accessibility | P0 |
| PlanWeekModal.tsx:187 | Sticky footer no `pb--ARB-env(safe-area-inset-bottom)-`. | Add. | Safe area | P0 |
| PlanWeekModal.tsx:88-92 | Same backdrop scrim as DayDetailSheet, `bg-black/30`. | OK at 30% with backdrop-blur, but for full-screen sheet on dark theme, blur saves it. | Depth | P2 |
| EditWeekModal.tsx:148-155 | Close 32×32; same issue. | 44pt. | Accessibility | P0 |
| EditWeekModal.tsx:181-188 | "Reset" mini-button no padding, `text-[11px]`. | 44pt or convert to icon button with hit area. | Accessibility | P0 |
| EditWeekModal.tsx:192-204 | Text input `py-2` ≈ 38px. | 44pt. | Accessibility | P1 |
| EditWeekModal.tsx:217 | Sticky footer no safe-area pad. | Add. | Safe area | P0 |
| PlanWeekModal.tsx:111-126 | Success state has only "Sluiten" button — modal can't be dismissed by Escape or backdrop after success. | Add Escape handler + ensure backdrop click works. | Accessibility | P1 |

**Tally Schema — P0: 12 · P1: 4 · P2: 1**

---

## 5. Progress (`src/app/progress/page.tsx`, `src/components/progress/*`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| ProgressPage.tsx:74,85 | `text-[34px]` heading repeats; tracking `[-0.8px]` matches `text-large-title` already in tokens. | Use token. | Clarity | P2 |
| ProgressPage.tsx:104-107 | Loader `animate-spin` — no reduce-motion. | `motion-reduce:animate-none`. | Motion | P1 |
| StrengthChart.tsx, VolumeChart.tsx, RunningChart.tsx, ProgressionChart.tsx | Recharts default `isAnimationActive=true` — no reduced-motion bridge. (Only `TonnageTrend.tsx:164` sets `false`.) | Set `isAnimationActive={!prefersReducedMotion}` or globally `false`. | Motion | P0 |
| ProgressPage.tsx Card:26 | Custom Card with `rounded-[22px] border-[0.5px]` matches v2 spec ✓; but text styles `text-[16px]` / `text-[12px]` bypass tokens. | `text-headline` / `text-caption1`. | Clarity | P2 |
| ExercisePicker (assumed) | Selectable list items — verify 44pt (skipped detail). | 44pt. | Accessibility | P1 |

**Tally Progress — P0: 1 (covers 4 charts) · P1: 2 · P2: 2**

---

## 6. Navigation cross-cutting (`src/components/layout/Navigation.tsx`, `MiniChat.tsx`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| Navigation.tsx:60-72 | Tab bar `h-[86px] pt-2 pb-[28px]` — does NOT use `env(safe-area-inset-bottom)`; baked-in 28px. | `pb-[max(env(safe-area-inset-bottom),16px)]`; total height responsive. | Safe area | P0 |
| Navigation.tsx:74-89 | Nav buttons `flex-1 min-w-[44px]` ✓, height ≈ 58px ✓. Good. | — | — | — |
| Navigation.tsx:67-71 | `background: rgba(30,34,48,0.85) + backdrop-blur(24px)` ✓ Liquid Glass. Top border `border-bg-border-strong`. | OK; consider `saturate(180%)` (already set) — looks correct. | Depth | — |
| Navigation.tsx:131-141 | More-sheet AnimatePresence — no `useReducedMotion()` guard; the `y: 100%` slide ignores reduce-motion. | Guard with `useReducedMotion`. | Motion | P0 |
| Navigation.tsx:144 | Backdrop `bg-black/50 backdrop-blur-sm` ✓ adequate. | — | — | — |
| Navigation.tsx:172-185 | More-sheet rows `py-3` ≈ 44px ✓, gap 12px — passes. | — | — | — |
| Navigation.tsx:222-251 | Sidebar nav `py-2.5` ≈ 38px — desktop but still touch on iPad. | 44pt for iPad mode. | Accessibility | P1 |
| Navigation.tsx:268-279 | Desktop sign-out `py-2.5`. | 44pt on iPad. | Accessibility | P1 |
| MiniChat.tsx + Navigation tab bar | MiniChat FAB at `bottom-24` (96px) overlaps tab bar's safe-area zone. | Recompute: tab bar 86px + safe-area + 8px gap. | Safe area | P0 |
| layout.tsx:45 | `<main>` only adds `pt--ARB-env(safe-area-inset-top)-`; many child pages then add another `pt-[60px]`. Result: double padding on notched devices. | Pick one. Recommend: layout adds top safe-area only, children use a `<ScreenHeader>` component with consistent 16px content offset. | Safe area | P1 |
| layout.tsx | No `<main>` `pb--ARB-env(safe-area-inset-bottom)-` on desktop — ok since sidebar; but mobile relies on tab bar. | OK for current model. | — | — |

**Tally Navigation — P0: 3 · P1: 3 · P2: 0**

---

## 7. Workout detail (`src/components/workout/WorkoutDetailPage.tsx`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| WorkoutDetailPage.tsx:240-247 | Back button `text-[17px]` no padding — height ≈ 22px. | 44pt min. | Accessibility | P0 |
| WorkoutDetailPage.tsx:254 | `text-[30px] font-bold tracking-[-0.7px]` instead of `text-title1` (28px) or custom. | Reuse Apple token. | Clarity | P2 |
| WorkoutDetailPage.tsx:232-272 | Hero gradient + radial overlay over `bg-bg-page` — no fallback for high-contrast / reduce-transparency setting. | Honour `@media (prefers-reduced-transparency)` to drop gradients to flat surface. | Depth / Accessibility | P1 |
| WorkoutDetailPage.tsx:276-318 | Stats grid `text-[18px]` and `text-[10px]`. | Tokens. | Clarity | P2 |
| WorkoutDetailPage.tsx:108 | `Card` from `@/components/ui/v2` — confirms v2; mostly compliant. | — | — | — |
| WorkoutDetailPage.tsx:84-87 | "↑ +Xkg" PR delta status uses Unicode arrow + raw `#22D67A` literal. | Use `<TrendingUp>` icon + `--color-status-good`. | Clarity | P2 |

**Tally Workout detail — P0: 1 · P1: 1 · P2: 3**

---

## 8. Nutrition (`src/app/nutrition/page.tsx`, `src/components/nutrition/*`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| NutritionPage.tsx:73,77 | `pt-[60px]` magic + `text-[28px]`. | Safe-area max + `text-title1`. | Clarity | P1 |
| NutritionPage.tsx:79-93 | Day prev/next buttons 36×36 (`h-9 w-9`). | 44pt. | Accessibility | P0 |
| NutritionInput.tsx:78 | Container `rounded-[14px]` not from token; should be `radius-card-md` (16px) per v2 tokens. | Use token. | Clarity | P2 |
| NutritionInput.tsx:89-100 | Send button 32×32 (`h-8 w-8`). | 44pt. Critical action. | Accessibility | P0 |
| NutritionInput.tsx:111-121 | Last-result preview uses `#16A34A` / `#D97706` / `#A8A29E` hex literals — Tailwind defaults, NOT Pulse status tokens. | `--color-status-good/warn/...`. | Clarity | P2 |

**Tally Nutrition — P0: 2 · P1: 1 · P2: 2**

---

## 9. Settings + OnboardingWizard

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| SettingsPage.tsx:161-162 | `pt-[60px]`, `text-[34px] font-bold tracking-[-0.8px]`. | Safe-area max + `text-large-title`. | Clarity | P1 |
| SettingsPage.tsx:183-235 | All form inputs `INPUT_CLASSES` use `py-2 text-sm` ≈ 36px. | 44pt min for iOS forms. | Accessibility | P0 |
| SettingsPage.tsx:297-303 | "Ontkoppel" button `py-1.5 text-sm` ≈ 32px. | 44pt. | Accessibility | P0 |
| SettingsPage.tsx:310-316 | "Koppel Google Agenda" `py-1.5`. | 44pt. | Accessibility | P0 |
| SettingsPage.tsx (whole) | Ten distinct surfaces with `border-[0.5px] border-bg-border` + `rounded-[18px]` — matches v2 ✓; mixes with `rounded-lg` in error tiles (8px). | Standardise to 12/16/22 token radii. | Clarity | P2 |
| OnboardingWizard.tsx:118 | `fixed inset-0 ... bg-rgba(0,0,0,0.5)` modal — no Escape close, no a11y `role="dialog"` / `aria-modal`. | Add ARIA + Escape. | Accessibility | P0 |
| OnboardingWizard.tsx:42 | `INPUT_CLASSES` `py-2 text-sm` ≈ 36px on every input. | 44pt. | Accessibility | P0 |
| OnboardingWizard.tsx:118-119 | Modal not scrollable for long forms; no `max-h-[90vh] overflow-y-auto`. | Add. | Clarity | P1 |
| OnboardingWizard.tsx:122-141 | Step pip 28×28; non-interactive. OK. | — | — | — |
| OnboardingWizard.tsx:259-285 | Goal sub-form selects 28×28-ish (`py-1.5 text-xs`). | 44pt. | Accessibility | P0 |
| OnboardingWizard.tsx:303-351 | Footer buttons `py-2 text-sm` ≈ 36px. Primary "Klaar" / "Volgende". | 44pt. | Accessibility | P0 |
| OnboardingWizard.tsx:303-323 | "Overslaan" left button is destructive-leaning but styled as muted text — risk of accidental skip. | Confirm dialog or de-emphasise / move under "More". | Clarity | P1 |

**Tally Settings + Onboarding — P0: 7 · P1: 3 · P2: 1**

---

## 10. Auth (`src/app/auth/login/page.tsx`, `signup/page.tsx`)

| Bestand:regel | Huidig | Gewenst | HIG | Sev |
|---|---|---|---|---|
| login.tsx:33,signup.tsx:40 | `min-h-screen` instead of `min-h-[100dvh]`. | Use dvh for mobile keyboard. | Clarity | P1 |
| login.tsx:36,signup.tsx:43 | `text-3xl` (Tailwind ~30px) for "Pulse"; subtitle `text-sm`. | `text-title1` / `text-subhead`. | Clarity | P2 |
| login.tsx:51,65 / signup.tsx:51,73,89 | All inputs `py-2 text-sm` ≈ 36px. | 44pt. | Accessibility | P0 |
| login.tsx:78-83 / signup.tsx:100-105 | Submit `py-3` ≈ 48px ✓. | OK. | — | — |
| login.tsx:88,signup.tsx:111 | "Registreren / Inloggen" link inline tap target ≈ 16×20px. | 44pt with padding. | Accessibility | P0 |
| login.tsx:33 | No `pt--ARB-env(safe-area-inset-top)-` — fine for centered layout. | OK. | — | — |
| login.tsx — no autofocus on email | iOS users land on a centered form with software keyboard collapsed. | `autoFocus` on email field. | Clarity | P2 |
| login.tsx,signup.tsx | Card `rounded-[14px]` — uses non-token radius; v2 expects `radius-card-md` (16). | Token. | Clarity | P2 |
| login.tsx,signup.tsx | Page background `bg-bg-grouped` resolves to `--color-bg-page` in dark mode — fine. Brand glow / hero absent → could feel boring; consider Liquid Glass card on radial gradient. | Polish. | Depth | P2 |

**Tally Auth — P0: 2 · P1: 1 · P2: 4**

---

## Motion & reduced-motion compliance

Apple HIG: every animation ≥ trivial duration must respect `prefers-reduced-motion`. Status per element:

| Element | Honours reduce-motion? | Notes | Sev |
|---|---|---|---|
| `globals.css` `@view-transition` | ✅ | `@media (prefers-reduced-motion: reduce)` overrides duration to 1ms. | — |
| `.animate-coach-orb` | ✅ | `motion-reduce:animate-none` applied at use site (`CoachOrb.tsx:50`). | — |
| `Skeleton` `animate-pulse` (`Skeleton.tsx:21`) | ❌ | Tailwind built-in, no reduce-motion variant. Affects every loading screen. | P0 |
| `animate-spin` spinners (≥ 12 occurrences: ChatInput, NutritionInput, WeekPlanCard, EditWeekModal, PlanWeekModal, ProgressPage, SettingsPage, SyncButton, ActivityFeed, WorkoutFeed, PlanChat) | ❌ | None use `motion-reduce:animate-none`. | P0 |
| `motion/react` list-stagger in DashboardPage.tsx:215 + Navigation More sheet `AnimatePresence` (Navigation.tsx:131) + `motion.div` sidebar pill (Navigation.tsx:240) | ❌ | No `useReducedMotion()` guard anywhere. | P0 |
| `TimeOfDayTheme.tsx:16` `transition-[background] duration-[1500ms]` | ❌ | 1.5s ambient cross-fade ignores reduce-motion. | P1 |
| `ReadinessSignal.tsx:91`, `PulseTriad.tsx:85` SVG `transition: stroke-dashoffset 600ms` | ❌ | Inline style; no media-query guard. | P0 |
| Recharts: StrengthChart, VolumeChart, RunningChart, ProgressionChart, BodyComposition charts | ❌ | Default `isAnimationActive=true`. Only `TonnageTrend` opts out. | P0 |
| `MiniChat.tsx` FAB `transition-transform hover:scale-105` | ❌ | Trivial but should still respect. | P2 |
| `motion/react` springs in WeekPlanCard, ConfirmationCard, EditReviewForm, PlanChat, ChatInput, etc. | ❌ | Same `motion/react` lack of `useReducedMotion`. | P1 |

**Recommendation:** add a `useReducedMotion()`-aware wrapper around every motion/react component, set Recharts global `isAnimationActive={!reduceMotion}`, and add `motion-reduce:animate-none` to Tailwind animation utilities project-wide (or extend Tailwind to inject it via plugin).

---

## Cross-cutting findings

- **Token discipline:** Apple type tokens (`text-large-title` … `text-caption2`) and v2 radius tokens are defined but bypassed in 80% of screens via raw `text-[Npx]` / `rounded-[Npx]`. This is the single biggest clarity tax — every refresh of the design system will require touching every component.
- **Color tokens:** `#0A84FF` (system blue) is hard-coded in ~40 files instead of `var(--color-system-blue)`. Sport-padel uses status-warn instead of `--color-sport-padel-base`.
- **Safe-area insets:** layout.tsx provides `pt--ARB-env(safe-area-inset-top)-`, but children re-pad with literal `pt-[60px]`/`pt-16`. Tab bar uses `pb-[28px]` literal rather than env. All bottom-anchored sheets miss `pb--ARB-env(safe-area-inset-bottom)-`.
- **Touch targets:** dozens of icon buttons are 24/28/32/36 px. Apple HIG floor is 44pt. This is by far the most frequent P0.
- **Liquid Glass:** Navigation tab bar is the only true glass surface (translucency + blur + saturate); good. Modals use `backdrop-blur-sm` (4px) which is too weak for Apple's 2026 thick-material look. Cards correctly avoid glass per v2 spec.
- **Dark-mode parity:** dark-only — but `:root` still sets `color-scheme: light` (globals.css:248). The `<html className="h-full dark">` is what activates dark, so the `:root` rule is dead but confusing. Consider `color-scheme: dark` directly.
- **Reduce-transparency:** zero `@media (prefers-reduced-transparency)` rules. WorkoutDetailPage hero gradients, TimeOfDayTheme overlay, and all glass surfaces should drop to flat colors.
- **VoiceOver:** rotating CoachOrb is `aria-hidden="true"` ✓; but most pages have decorative `<Link>` wrapping mixed icon+text without aria-labels. Many skeletons missing `role="status"` / `aria-busy`.

---

## Severity totals (per scherm)

| Scherm | P0 | P1 | P2 |
|---|---:|---:|---:|
| 1. Home | 6 | 6 | 9 |
| 2. Check-in | 11 | 4 | 4 |
| 3. Chat | 5 | 4 | 2 |
| 4. Schema | 12 | 4 | 1 |
| 5. Progress | 1 | 2 | 2 |
| 6. Navigation cross-cutting | 3 | 3 | 0 |
| 7. Workout detail | 1 | 1 | 3 |
| 8. Nutrition | 2 | 1 | 2 |
| 9. Settings + Onboarding | 7 | 3 | 1 |
| 10. Auth | 2 | 1 | 4 |
| Motion compliance | 5 (additional) | 2 | 1 |
| **Totaal** | **55** | **31** | **29** |

---

## Top 5 recommendations (in order)

1. **Touch-target sweep** — bump every `h-6/h-7/h-8/h-9` and `py-1/py-1.5/py-2/py-2.5` button to `min-h-[44px]` (or wrap icons in 44pt frames). Single highest-yield a11y fix; ~50 sites.
2. **Reduced-motion compliance** — add `useReducedMotion()` to all motion/react usage, `motion-reduce:animate-none` to all `animate-spin`/`animate-pulse`, and `isAnimationActive={!reduce}` to all Recharts.
3. **Safe-area discipline** — replace `pt-[60px]` with `pt-[max(env(safe-area-inset-top),60px)]`; replace `pb-[28px]` in tab bar with env-based; add `pb--ARB-env(safe-area-inset-bottom)-` to all bottom-sheet modals (ManualAddModal, PlanWeekModal, EditWeekModal, DayDetailSheet, ChatInput).
4. **Token migration** — kill raw `text-[Npx]`, `rounded-[Npx]`, hard-coded hex colors. Lint-rule candidate.
5. **Modal a11y** — add `role="dialog"`, `aria-modal="true"`, Escape handling, and focus trap to OnboardingWizard, ManualAddModal, DayDetailSheet, PlanWeekModal, EditWeekModal.
