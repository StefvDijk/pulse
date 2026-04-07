/**
 * Apple-achtige spring physics presets voor Framer Motion (pkg: "motion").
 *
 * Consistente animaties door de hele app — verantwoordelijk voor het
 * "soepel" gevoel dat iOS apps hebben. Gebruik deze presets liever dan
 * ad-hoc transitions.
 */

import type { Transition, Variants } from 'motion/react'

/* ─── Spring presets ─────────────────────────────────────────────────────── */

/** Standaard page/content transition — zacht en rustig */
export const springContent: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

/** Interactieve elementen — net iets sneller */
export const springInteractive: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
}

/** Tab/layout transitions — snelste, voor UI plumbing */
export const springLayout: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
}

/* ─── Variants ───────────────────────────────────────────────────────────── */

/** Page transition: fade + subtle rise */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

/** Card entry: fade in met lichte opwaartse beweging */
export const cardEnter: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

/** Staggered list: gebruik met `staggerChildren` op parent */
export const listContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
}

export const listItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
}

/* ─── Interaction hover/tap ──────────────────────────────────────────────── */

/** Card hover + tap feedback — Apple spring */
export const cardInteraction = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: springInteractive,
}

/** Button tap — alleen scale-down, geen hover (touch-first) */
export const buttonTap = {
  whileTap: { scale: 0.96 },
  transition: springInteractive,
}
