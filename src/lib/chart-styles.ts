/**
 * Apple HIG chart styling constants for Recharts.
 *
 * Gebruikt CSS variabelen zodat de charts automatisch mee-adapteren aan
 * light/dark mode wanneer dark mode getoggled wordt.
 */

/* ─── Apple System Colors (als CSS variabelen) ───────────────────────────── */

export const appleChartColors = {
  blue: 'var(--color-system-blue)',
  green: 'var(--color-system-green)',
  orange: 'var(--color-system-orange)',
  red: 'var(--color-system-red)',
  purple: 'var(--color-system-purple)',
  teal: 'var(--color-system-teal)',
  yellow: 'var(--color-system-yellow)',
  indigo: 'var(--color-system-indigo)',
  pink: 'var(--color-system-pink)',
} as const

/** Sport mapping — consistent met de rest van de app */
export const sportColors = {
  gym: appleChartColors.blue,
  run: appleChartColors.orange,
  padel: appleChartColors.yellow,
  cycle: appleChartColors.green,
} as const

/** Macro mapping — natuurlijke food kleuren */
export const macroColors = {
  protein: appleChartColors.red,
  carbs: appleChartColors.orange,
  fat: appleChartColors.yellow,
  fiber: appleChartColors.green,
} as const

/* ─── Recharts axis defaults ─────────────────────────────────────────────── */

export const appleAxisTick = {
  fill: 'var(--color-label-tertiary)',
  fontSize: 11,
}

/* ─── Recharts tooltip — glass-effect ────────────────────────────────────── */

export const appleTooltipStyle = {
  backgroundColor: 'var(--color-surface-secondary)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid var(--color-separator)',
  borderRadius: '12px',
  boxShadow:
    '0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.04)',
  padding: '8px 12px',
}

export const appleTooltipLabelStyle = {
  color: 'var(--color-label-primary)',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
}

export const appleTooltipItemStyle = {
  color: 'var(--color-label-secondary)',
  fontSize: 12,
}

/* ─── Bars: rounded top corners (Apple-style) ────────────────────────────── */

export const appleBarRadius: [number, number, number, number] = [8, 8, 0, 0]
