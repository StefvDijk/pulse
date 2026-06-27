# Pulse Design Overhaul: Apple HIG Style

## Doel

Pulse transformeren van een functioneel dashboard naar een strak, Apple-achtig design. Geen gimmicks, geen overdesign. Focus op clarity, depth, en consistency — de drie pijlers van Apple's HIG.

## Huidige stack

- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS
- Recharts voor charts
- SWR voor data fetching
- Supabase

## Wat verandert

### 1. Design Tokens (globals.css)

Vervang het huidige kleurenpalet volledig door Apple's system colors. Dit is de basis waarop alles rust.

```css
@layer base {
  :root {
    /* Apple System Colors */
    --system-blue: #007AFF;
    --system-green: #34C759;
    --system-orange: #FF9500;
    --system-red: #FF3B30;
    --system-purple: #AF52DE;
    --system-teal: #5AC8FA;
    --system-yellow: #FFCC00;
    --system-indigo: #5856D6;
    --system-pink: #FF2D55;

    /* Gray Scale */
    --system-gray: #8E8E93;
    --system-gray2: #AEAEB2;
    --system-gray3: #C7C7CC;
    --system-gray4: #D1D1D6;
    --system-gray5: #E5E5EA;
    --system-gray6: #F2F2F7;

    /* Semantic Labels */
    --label-primary: #000000;
    --label-secondary: rgba(60, 60, 67, 0.6);
    --label-tertiary: rgba(60, 60, 67, 0.3);

    /* Backgrounds */
    --bg-primary: #FFFFFF;
    --bg-secondary: #F2F2F7;
    --bg-tertiary: #FFFFFF;
    --bg-grouped: #F2F2F7;

    /* Surfaces (cards, modals) */
    --surface-primary: #FFFFFF;
    --surface-secondary: rgba(255, 255, 255, 0.8);

    /* Separators */
    --separator: rgba(60, 60, 67, 0.29);
    --separator-opaque: #C6C6C8;
  }

  .dark {
    --system-blue: #0A84FF;
    --system-green: #30D158;
    --system-orange: #FF9F0A;
    --system-red: #FF453A;
    --system-purple: #BF5AF2;
    --system-teal: #64D2FF;
    --system-yellow: #FFD60A;
    --system-indigo: #5E5CE6;
    --system-pink: #FF375F;

    --system-gray: #8E8E93;
    --system-gray2: #636366;
    --system-gray3: #48484A;
    --system-gray4: #3A3A3C;
    --system-gray5: #2C2C2E;
    --system-gray6: #1C1C1E;

    --label-primary: #FFFFFF;
    --label-secondary: rgba(235, 235, 245, 0.6);
    --label-tertiary: rgba(235, 235, 245, 0.3);

    --bg-primary: #000000;
    --bg-secondary: #1C1C1E;
    --bg-tertiary: #2C2C2E;
    --bg-grouped: #000000;

    --surface-primary: #1C1C1E;
    --surface-secondary: rgba(28, 28, 30, 0.8);

    --separator: rgba(84, 84, 88, 0.6);
    --separator-opaque: #38383A;
  }
}
```

### 2. Typography

Font stack en scale volgens Apple HIG:

```css
:root {
  --font-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
                 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', SFMono-Regular, Menlo, Monaco, monospace;

  /* Type Scale */
  --text-caption2: 11px;
  --text-caption1: 12px;
  --text-footnote: 13px;
  --text-subhead: 15px;
  --text-body: 17px;
  --text-headline: 17px;  /* semibold */
  --text-title3: 20px;
  --text-title2: 22px;
  --text-title1: 28px;
  --text-large-title: 34px;
}
```

In Tailwind config mappen:

```js
// tailwind.config.ts
theme: {
  extend: {
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['SF Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
    },
    fontSize: {
      'caption2': ['11px', { lineHeight: '13px', letterSpacing: '0.07em' }],
      'caption1': ['12px', { lineHeight: '16px' }],
      'footnote': ['13px', { lineHeight: '18px' }],
      'subhead': ['15px', { lineHeight: '20px' }],
      'body': ['17px', { lineHeight: '22px' }],
      'headline': ['17px', { lineHeight: '22px', fontWeight: '600' }],
      'title3': ['20px', { lineHeight: '25px' }],
      'title2': ['22px', { lineHeight: '28px' }],
      'title1': ['28px', { lineHeight: '34px' }],
      'large-title': ['34px', { lineHeight: '41px' }],
    },
  }
}
```

### 3. Spacing: 8pt Grid

Alles in veelvouden van 4/8px. Tailwind's default spacing is al in 4px stappen, dus:

- `p-1` = 4px (tight)
- `p-2` = 8px (compact)
- `p-3` = 12px (comfortable)
- `p-4` = 16px (spacious)
- `gap-4` = 16px tussen cards
- `gap-6` = 24px tussen secties

Regel: gebruik consistente padding per component-type:
- Cards: `p-4` (16px)
- Sections: `py-6` (24px)
- Page: `px-4` mobile, `px-6` desktop
- Between cards in a grid: `gap-4`

### 4. Border Radius (Concentric Design)

Apple's geheim: geneste elementen hebben afnemende border-radius.

```
Outer container:  rounded-2xl  (16px)
  Inner card:     rounded-xl   (12px)
    Inner button: rounded-lg   (8px)
```

Capsule buttons (primary actions): `rounded-full` (9999px)

### 5. Shadows & Depth

Apple gebruikt subtiele, gelayerde schaduwen. Geen harde `shadow-lg`.

```css
/* Tailwind custom shadows */
boxShadow: {
  'apple-sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
  'apple': '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
  'apple-md': '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
  'apple-lg': '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.04)',
  'apple-float': '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.06)',
}
```

Dark mode: schaduwen werken minder, gebruik in plaats daarvan subtiele borders:

```css
.dark .card {
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

### 6. Glass / Blur Effects (Spaarzaam)

Alleen op: tab bar, modals, chat overlay. Niet op gewone cards.

```css
.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.dark .glass {
  background: rgba(28, 28, 30, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### 7. Animaties

Framer Motion met Apple-achtige spring physics:

```tsx
// Standaard page transition
const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 300, damping: 30 }
};

// Card hover
const cardHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 400, damping: 25 }
};

// Tab switch
const tabTransition = {
  layout: true,
  transition: { type: "spring", stiffness: 500, damping: 35 }
};
```

Installeer `framer-motion` als dependency.

### 8. Componenten: Specifieke Wijzigingen

#### Cards (WorkoutCard, StatCard, etc.)

```
Oud:  rounded-lg bg-gray-800 p-4 border border-gray-700
Nieuw: rounded-2xl bg-[--surface-primary] p-4 shadow-apple
       dark:bg-[--surface-primary] dark:border dark:border-white/[0.06]
```

#### Buttons

Primary: capsule shape, system-blue, wit label, min-height 44px
```
rounded-full bg-[--system-blue] text-white font-semibold
min-h-[44px] px-6
hover:brightness-110 active:scale-[0.98]
transition-all duration-150
```

Secondary: capsule shape, system-blue op transparent
```
rounded-full bg-[--system-blue]/10 text-[--system-blue] font-semibold
min-h-[44px] px-6
```

Ghost/Tertiary: geen background, alleen label
```
text-[--system-blue] font-medium min-h-[44px] px-4
```

#### Navigation / Tab Bar

Bottom tab bar met glass effect:
```
fixed bottom-0 left-0 right-0
bg-white/72 dark:bg-[#1C1C1E]/72
backdrop-blur-xl border-t border-[--separator]
flex items-center justify-around h-[83px] pb-[34px]
```

Active tab: `text-[--system-blue]`
Inactive tab: `text-[--system-gray]`

#### Charts (Recharts)

- Gebruik `--system-blue`, `--system-green`, `--system-orange` als chart kleuren
- Verwijder grid lines (zet `strokeDasharray` op niets, of verberg)
- Gebruik `--label-tertiary` voor axis labels
- `--separator` voor subtiele gridlines als ze nodig zijn
- Rounded bars: `radius={[8, 8, 0, 0]}`
- Tooltip: glass effect met `backdrop-blur`

#### Chat Interface

- User berichten: `bg-[--system-blue] text-white rounded-2xl rounded-br-md`
- Assistant berichten: `bg-[--bg-secondary] dark:bg-[--bg-tertiary] rounded-2xl rounded-bl-md`
- Input: `rounded-full bg-[--bg-secondary] border-none min-h-[44px]`
- Verstuur knop: `rounded-full bg-[--system-blue] w-[36px] h-[36px]`

### 9. Layout Principes

- **Content-first**: minder chrome, meer whitespace
- **Grouped style**: gebruik `bg-[--bg-grouped]` als page background, witte/donkere cards erop
- **Section headers**: `text-footnote uppercase tracking-wider text-[--label-secondary] px-4 mb-2`
  (net als iOS Settings)
- **Lists**: gebruik `divide-y divide-[--separator]` binnen cards
- **Touch targets**: alles clickbare minimaal 44px hoog

### 10. Icons

Gebruik `lucide-react` (al compatible met je stack). Voor een meer Apple-achtige feel:
- `strokeWidth={1.5}` (dunner dan default 2)
- Consistent `size={22}` voor nav icons, `size={18}` voor inline

## Uitvoeringsvolgorde

1. **Design tokens** — globals.css + tailwind.config.ts (~30 min)
2. **Basis componenten** — Button, Card, Input als herbruikbare componenten (~1 uur)
3. **Layout** — Tab bar + page wrapper met grouped background (~1 uur)
4. **Dashboard cards** restylen (~1 uur)
5. **Charts** restylen (~30 min)
6. **Chat interface** restylen (~30 min)
7. **Animaties** toevoegen met Framer Motion (~30 min)
8. **Polish** — dark mode check, spacing audit, consistency pass (~1 uur)

Totaal: ~6-7 uur werk

## Referenties

- Apple HIG: https://developer.apple.com/design/human-interface-guidelines
- WWDC25 Design System talk: https://developer.apple.com/videos/play/wwdc2025/356/
- Apple HIG Designer Skill (Smithery): https://smithery.ai/skills/axiaoge2/apple-hig-designer
- React Liquid Kit: https://medium.com/design-bootcamp/designing-for-liquid-glass
- @mawtech/glass-ui: `npm install @mawtech/glass-ui`
- Shadcn theme tools: https://tweakcn.com, https://ui.jln.dev
