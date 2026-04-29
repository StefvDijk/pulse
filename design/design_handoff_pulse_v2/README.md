# Handoff: Pulse v2 — Visual Redesign

## Overview

Pulse is a personal health & training dashboard (Next.js 14 + Tailwind + Supabase) that aggregates Hevy, Apple Health, and Runna data into one interface, with an AI coach. This handoff redesigns the **visual layer** of the existing app — colors, typography, layout, card treatments — inspired by Apple Fitness+ and Athlytic.

**It does not redesign the data model, hooks, API routes, or business logic.** All existing functionality must be preserved.

---

## About the design files

Files in this bundle are **HTML/JSX design references** — prototypes that show the intended look and feel. They are **not production code to copy directly**. The Pulse codebase is Next.js + TypeScript + Tailwind; recreate these designs using the codebase's existing patterns (shadcn-style components, Tailwind utility classes, the existing hooks like `useSchemaWeek`, `useWorkload`, etc.).

The HTML mocks use inline-style React for fast iteration. **Translate inline styles to Tailwind utility classes or extend the Tailwind config with the design tokens below.**

## Fidelity

**High-fidelity.** Colors, typography, spacing, and component structure are final. Recreate pixel-perfectly where possible.

---

## ⚠️ Critical: do not overwrite functionality

The Pulse codebase has many features that are **not** in these mocks:
- `OnboardingWizard`, `CoachingMemoryEditor`, `AIContextPreview`
- `EditWeekModal`, `PlanWeekModal`, `ManualAddModal`, `MuscleDrilldownSheet`
- `CalendarConnect` (Google Calendar integration), Strava connection flows
- `CheckInHistoryPage`, error boundaries, skeleton loaders
- All `/api/*` routes, all hooks, the entire data layer
- Auth pages (`/auth/login`, `/auth/signup`)

**Rules for the implementer:**

1. **Work in a feature branch** (e.g. `redesign-pulse-v2`). Never push to `main` directly.
2. **Apply the design tokens first** — extend `tailwind.config.ts` with the new color/font/radius scales. Do this in a single commit so the rest of the changes are isolated.
3. **For pages explicitly mocked in this handoff** (Home, Schema, Progress, Nutrition, Coach, Workload, Goals, Trends, Check-in, Workout Detail, Settings), recreate the layout per the spec.
4. **For pages/modals/components NOT mocked here** (everything in the list above), **do not redesign or rewrite them**. Just apply the new design tokens (background, text, border colors, fonts, radii) so they're visually consistent. Leave structure, copy, and behavior alone.
5. **Never delete a hook, API route, or database call.** If a mocked screen seems to drop a feature, assume it's an oversight in the mock — keep the existing functionality and integrate it where it best fits.
6. **Show diffs before committing.** Implementer should propose changes file-by-file, not in bulk.
7. **Migrate one screen at a time.** Recommended order: tokens → Home → Schema → Workout Detail → Workload → Goals → Progress → Nutrition → Coach → Trends → Check-in → Settings → remaining unmapped pages (apply tokens only).

---

## Design tokens

These live in `tokens.js` in the design bundle. Translate to `tailwind.config.ts` extension.

### Colors

```ts
// tailwind.config.ts → theme.extend.colors
colors: {
  // Backgrounds — softer dark, slightly lifted
  bg: {
    page:        '#15171F',
    surface:     '#1E2230',  // card base
    elevated:    '#272C3B',  // raised card
    glass:       'rgba(255,255,255,0.05)',
    glassStrong: 'rgba(255,255,255,0.08)',
    border:      'rgba(255,255,255,0.08)',
    borderStrong:'rgba(255,255,255,0.12)',
  },
  text: {
    primary:   '#F5F5F7',
    secondary: 'rgba(245,245,247,0.66)',
    tertiary:  'rgba(245,245,247,0.46)',
    muted:     'rgba(245,245,247,0.26)',
  },
  // Sport accents — saturated, vivid
  sport: {
    'gym-base':   '#00E5C7',
    'gym-light':  'rgba(0,229,199,0.18)',
    'gym-glow':   'rgba(0,229,199,0.50)',
    'gym-dark':   '#0A4F45',
    'run-base':   '#FF5E3A',
    'run-light':  'rgba(255,94,58,0.18)',
    'run-glow':   'rgba(255,94,58,0.55)',
    'run-dark':   '#5C1F11',
    'padel-base': '#FFB020',
    'padel-light':'rgba(255,176,32,0.18)',
    'padel-glow': 'rgba(255,176,32,0.50)',
    'padel-dark': '#5C3D08',
    'cycle-base': '#9CFF4F',
  },
  status: {
    good: '#22D67A',
    warn: '#FFB020',
    bad:  '#FF4D6D',
  },
  brand: {
    claude: '#D97757',  // Anthropic coral — used for Coach indicator
  },
}
```

### Hero gradients (for accent backgrounds, never on cards body)

```css
--gradient-aurora: linear-gradient(135deg, #FF5E3A 0%, #FF2D87 35%, #7C3AED 70%, #00E5C7 100%);
--gradient-fire:   linear-gradient(135deg, #FFB020 0%, #FF5E3A 50%, #FF2D87 100%);
--gradient-cool:   linear-gradient(135deg, #00E5C7 0%, #4FC3F7 50%, #7C3AED 100%);
--gradient-coach:  linear-gradient(135deg, rgba(10,132,255,0.10), rgba(124,58,237,0.06));
```

### Typography

**Font family**: SF Pro Display (Apple Fitness+ uses this).
Load from Apple's CDN — `applesocial.s3.amazonaws.com/.../sanfranciscodisplay-{regular|medium|semibold|bold|heavy}-webfont.woff2`. See `Pulse Redesign.html` for the `@font-face` block. Fallback stack:

```css
font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", sans-serif;
```

Use `-webkit-font-smoothing: antialiased` on body.

**Type scale** (used throughout the mocks):

| Role             | Size   | Weight | Letter-spacing | Use                           |
|------------------|--------|--------|----------------|-------------------------------|
| Display L        | 64px   | 700    | -2px           | Big numeric (workload ratio)  |
| Display M        | 34px   | 700    | -0.8px         | Page title                    |
| Title            | 28px   | 700    | -0.6px         | Section header / hero         |
| Subtitle         | 22px   | 700    | -0.4px         | Card title big                |
| Body L           | 17px   | 600    | -0.2px         | Card title                    |
| Body             | 15px   | 500–600| 0              | Standard text                 |
| Body S           | 13px   | 400–500| 0              | Secondary text, captions      |
| Caption          | 11px   | 500    | 0              | Sub-captions                  |
| Eyebrow / label  | 10–11px| 600    | 0.4px (uppercase) | All caps eyebrows         |
| Tabular numeric  |        |        |                | Always set `font-variant-numeric: tabular-nums` on numbers |

### Radius scale

| Token | Value | Use                                |
|-------|-------|------------------------------------|
| `sm`  | 10    | Pills, badges, small buttons       |
| `md`  | 16    | List items, inline cards           |
| `lg`  | 22    | Standard card                      |
| `xl`  | 28    | Hero card / large feature card     |

### Spacing

Use Tailwind's default 4px scale. Most card padding is `14–18px` (`p-4 / p-[18px]`). Most card-to-card gap is `8–14px` (`gap-2 / gap-3`). Page horizontal padding is `16px` (`px-4`).

### Borders

Cards: `0.5px solid rgba(255,255,255,0.08)` — rendered as `border border-bg-border` in Tailwind. The 0.5px hairline is significant: use `border-[0.5px]`.

### Shadows / glows

Sport accents glow: `box-shadow: 0 0 8px <sport.base>` on indicator dots/bars. Buttons: `0 4px 14px rgba(<color>, 0.35–0.4)`. No drop shadows on cards (they're flat on the dark background).

---

## Screens

Each screen is in the bundle as a JSX component. Below is the spec; the JSX is the visual reference.

### 1. Home (Data-rich) — `screens/Home.jsx::HomeData`

**Purpose**: Daily landing screen. Shows readiness, today's workout, week glance, daily activity bar.

**Layout (top → bottom)**:
1. **Header** (60px top padding): "Vandaag" (28/700), date subtitle (13/500/secondary). Right side: `<CoachOrb size={32}/>` (Claude logo on coral circle).
2. **Readiness card**: large numeric "84" in HR-zone-green, label "Klaar om te trainen", three small stats (HRV, Sleep, RHR) in a row. Padding 18, radius 22.
3. **Today workout hero**: gradient-tinted card (aurora glow), sport bar, workout title, exercise count + duration, primary CTA button.
4. **Week glance strip**: 7 day pills (Ma–Zo), each showing sport color dot + status (done/today/planned/rest).
5. **Daily health bar**: 3-stat horizontal — Steps, Active kcal, Standing — with mini-rings.
6. **Coach insight card**: dark gradient bg with `<CoachOrb size={28}/>`, eyebrow "COACH", insight text, "›" affordance.

**Data hooks to wire in**:
- `useSchemaWeek` (existing) for today's workout + week
- `useReadiness` (existing) for the readiness number
- `useDashboard` (existing) for daily activity stats

### 2. Schema — Week & Detail — `screens/Other.jsx::SchemaWeek` / `SchemaDetail`

**Week view**: Block title ("Upper/Lower blok 3"), week-of-block progress bar, list of 7 days as cards. Each day card: date column (44px), 3px sport-color bar (with glow if active), title, duration, status icon. Today is highlighted with a subtle gradient + glow border.

**Detail view**: Day header, exercise list. Each exercise: muscle-color icon tile, name, set/rep summary. Sets in compact rows: warmup grayed (50% opacity), working sets full opacity, PR badge (gold pill) on PR sets, "+2.5kg" green delta on improvements.

**Wire to**: `useSchemaWeek`, `useWorkoutDetail`.

### 3. Workout detail — `screens/More.jsx::WorkoutDetail`

Replaces `pulse/src/components/workout/WorkoutDetailPage.tsx`. Hero with gradient + PR pill ("🏆 1 nieuwe PR · Bench +2.5kg"), 4-stat grid bar (duration, sets, tonnage, avg HR), exercise cards with the same set rows as Schema Detail, notes card at bottom.

**Wire to**: `useWorkoutDetail`.

### 4. Progressie — `screens/Other.jsx::Progress`

Multi-line chart (movement patterns: push, pull, squat, hinge — 4 colored lines on shared axis), period selector tabs (4w / 3m / 6m / 1y), running progression chart (bars + pace line combo), PR list (top 5).

**Wire to**: existing `useProgressData`, `/api/progress/exercise`.

### 5. Voeding — `screens/Other.jsx::Nutrition`

Big macro donut showing protein/carbs/fat split with daily total in center, target vs actual ring. Natural-language input field with `<CoachOrb/>` indicator and "LOG NATUURLIJK" eyebrow. Today's meals list (timestamp, raw input, kcal/protein chips). 7-day trend strip below.

**Wire to**: `useNutrition`, `/api/nutrition/analyze`.

### 6. Coach — `screens/Other.jsx::Coach`

Full-page chat. Hero header with `<CoachOrb size={40}/>` + "Pulse Coach" title. Suggested-question chips above input. Message list: user bubbles (right, neutral surface), coach bubbles (left, with small CoachOrb avatar, gradient-tinted bg). Inline data cards inside coach replies (e.g. workout summary, week plan card). Input bar fixed at bottom with mic + send.

**Wire to**: `useChat`, `/api/chat` (streaming).

### 7. Belasting (Workload) — `screens/More.jsx::Workload`

Replaces `WorkloadPage.tsx`. Big ratio number (64/700, e.g. "1.18"), zone bar (5 zones: low/caution/optimal/warning/danger) with current-position indicator, status pill (color-coded), explanation paragraph, 12-week sparkline, 4-stat grid (acute/chronic/sessions/tonnage), per-sport breakdown.

**Wire to**: `useWorkload`.

### 8. Doelen (Goals) — `screens/More.jsx::Goals`

Replaces `GoalsPage.tsx`. Quarter goal hero card (gradient tinted), goal list with category tag, priority star, current/target numbers, progress bar in sport color. Completed goals collapsed at bottom.

**Wire to**: `useGoals`, `/api/goals`.

### 9. Trends — `screens/More.jsx::Trends`

Replaces `TrendsPage.tsx`. Three cards: Month-over-month comparison (label / prev / current / Δ%), Quarter bar chart (3 months), "A year ago" gradient card with then-vs-now comparison.

**Wire to**: `useTrendsData`.

### 10. Check-in — `screens/More.jsx::CheckIn`

Replaces `CheckInFlow.tsx`. 4-step indicator (Review · Analyse · Planning · Bevestig) at top with completed/active/pending states. Coach analysis card (gradient tinted, with CoachOrb), 3-stat mini grid inside. Week-plan card with 7 day rows. Primary CTA button at bottom (linear-gradient indigo→purple).

**Wire to**: `useCheckInReview`, all `/api/check-in/*` routes.

### 11. Settings — `screens/More.jsx::Settings`

Replaces `SettingsPage.tsx`. Profile header (gradient tinted) with avatar, name, age/weight/height. Grouped iOS-style settings rows: Verbindingen / Training / Coach / Account. Each row: 28px colored icon tile, label, value, chevron. Destructive actions in `status.bad` red.

**Wire to**: `useSettings`.

### Coach indicator (`CoachOrb`) — used everywhere

Defined in `screens/Home.jsx`. **Use Anthropic's Claude logo on a coral circle** anywhere AI/coach is invoked:

```jsx
<div className="rounded-full bg-brand-claude flex items-center justify-center" style={{width: size, height: size, boxShadow: '0 2px 8px rgba(217,119,87,0.35)'}}>
  <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62}>
    <path d="..." fill="#FFFFFF"/>
  </svg>
</div>
```

The full SVG path is in `screens/Home.jsx` — copy it verbatim. Sizes used: 20 (inline in chat), 28 (insight card), 32 (Home header), 40 (Coach page hero).

---

## Interactions & behavior

The mocks are static. Behavior should match the existing app — none of the existing user flows change. Specifically:

- **No changes to navigation** — bottom tab bar stays 5 items: Home / Schema / Progressie / Voeding / Coach. Sub-pages (Workload, Goals, Trends, Check-in, Settings, Workout Detail) keep their existing entry points (links from Home, from Settings, from list rows).
- **All loading states**: keep existing `Skeleton` components but restyle them (use `bg-bg-surface` for the skeleton pulse base instead of `bg-system-gray6`).
- **All error states**: keep `ErrorAlert`, restyle.
- **Animations**: existing motion-react transitions stay. If adding new ones, use the same easing/duration as the existing `springContent` preset.
- **Hover/active**: on touch targets, use `active:opacity-60` (iOS-feel).
- **Tab bar**: 86px tall, blurred translucent bg `rgba(30,34,48,0.85)` + `backdrop-filter: blur(24px) saturate(180%)`, top border `border-bg-borderStrong`. Active tab: white icon + label, 4px green dot underneath with `0 0 8px #00E5C7` glow.

---

## Tailwind config patch

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: { /* see above */ },
      fontFamily: {
        sans: ['SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card-sm': '10px',
        'card-md': '16px',
        'card-lg': '22px',
        'card-xl': '28px',
      },
      backgroundImage: {
        'gradient-aurora': 'linear-gradient(135deg, #FF5E3A 0%, #FF2D87 35%, #7C3AED 70%, #00E5C7 100%)',
        'gradient-coach':  'linear-gradient(135deg, rgba(10,132,255,0.10), rgba(124,58,237,0.06))',
      },
    },
  },
}
```

`globals.css`:

```css
@font-face {
  font-family: 'SF Pro Display';
  font-weight: 400;
  src: url('https://applesocial.s3.amazonaws.com/assets/styles/fonts/sanfrancisco/sanfranciscodisplay-regular-webfont.woff2') format('woff2');
  font-display: swap;
}
/* repeat for 500, 600, 700, 800 — see Pulse Redesign.html */

body {
  background: #15171F;
  color: #F5F5F7;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

---

## Files in this bundle

- `Pulse Redesign.html` — entry point. Loads tokens, frame components, and screens.
- `tokens.js` — design tokens.
- `screens/Home.jsx` — Home variants + atoms (`CoachOrb`, `ReadinessOrb`, `BodyHeatmapCard`, `ZoneBar`, etc.).
- `screens/Other.jsx` — Schema (Week + Detail), Progress, Coach, Nutrition.
- `screens/More.jsx` — Workload, Goals, Trends, Check-in, Settings, Workout Detail.
- `ios-frame.jsx`, `design-canvas.jsx` — viewer chrome (NOT to be ported, just for previewing).

Open `Pulse Redesign.html` in a browser to see all screens side-by-side.

---

## Suggested implementation order

1. **Tokens commit** — extend `tailwind.config.ts`, add `@font-face` rules to `globals.css`. Verify visually that existing pages now use SF Pro and the dark palette.
2. **CoachOrb component** — add as `src/components/ui/CoachOrb.tsx`. Replace existing AI/sparkle indicators throughout.
3. **Home** (`DashboardPage.tsx`) — restyle in place using existing hooks. Compare to `HomeData` mock.
4. **Workout Detail** — restyle `WorkoutDetailPage.tsx`.
5. **Schema** — restyle `SchemaPageContent.tsx` + child components.
6. **Workload, Goals, Progress, Trends, Nutrition, Coach, Check-in, Settings** — one PR per page.
7. **Apply tokens to remaining pages** — Onboarding, all modals, auth pages, error boundaries. No structural changes.

Each step in its own commit; merge to `main` only after visual review.

---

## Questions for the implementer to ask back

- Does Pulse already have a Tailwind dark mode setup, or is this app dark-only? (Mocks assume always-dark.)
- Should the existing `text-system-blue`, `bg-system-gray6`, etc. utility classes stay (with new values) or be renamed? (Recommend: rename to the new token names to avoid confusion.)
- Is Apple's CDN for SF Pro acceptable for production, or should the woff2 files be self-hosted in `public/fonts/`? (Self-hosting is more reliable.)
