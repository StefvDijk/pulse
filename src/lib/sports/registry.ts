import {
  Dumbbell, Footprints, Mountain, CircleDot, Bike, Waves,
  Flame, PersonStanding, Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Canonieke sport-taxonomie van Pulse. Single source of truth voor:
 * - classificatie van externe labels (Apple/Strava) → SportKey (zie ./classify)
 * - presentatie (icoon, kleur, label) in feed + weekstrip
 * - het belasting-model per sport (loadModel — haak voor een latere fase)
 */
export type SportKey =
  | 'gym' | 'run' | 'walk' | 'padel'
  | 'tennis' | 'squash' | 'hiit' | 'football' | 'yoga'
  | 'cycle' | 'swim' | 'other'

export type LoadModel = 'tonnage' | 'run-acwr' | 'duration-hr' | 'none'

export interface SportMeta {
  key: SportKey
  label: string
  icon: LucideIcon
  colorBase: string
  colorLight: string
  loadModel: LoadModel
}

const lt = (rgb: string): string => `rgba(${rgb},0.18)`

export const SPORT_META: Record<SportKey, SportMeta> = {
  gym:      { key: 'gym',      label: 'Krachttraining', icon: Dumbbell,       colorBase: '#00E5C7', colorLight: lt('0,229,199'),   loadModel: 'tonnage' },
  run:      { key: 'run',      label: 'Hardlopen',      icon: Footprints,     colorBase: '#FF5E3A', colorLight: lt('255,94,58'),   loadModel: 'run-acwr' },
  walk:     { key: 'walk',     label: 'Wandeling',      icon: Mountain,       colorBase: '#22D67A', colorLight: lt('34,214,122'),  loadModel: 'none' },
  padel:    { key: 'padel',    label: 'Padel',          icon: CircleDot,      colorBase: '#FFB020', colorLight: lt('255,176,32'),  loadModel: 'duration-hr' },
  tennis:   { key: 'tennis',   label: 'Tennis',         icon: CircleDot,      colorBase: '#4FC3F7', colorLight: lt('79,195,247'),  loadModel: 'duration-hr' },
  squash:   { key: 'squash',   label: 'Squash',         icon: CircleDot,      colorBase: '#7C3AED', colorLight: lt('124,58,237'),  loadModel: 'duration-hr' },
  hiit:     { key: 'hiit',     label: 'HIIT',           icon: Flame,          colorBase: '#FF2D87', colorLight: lt('255,45,135'),  loadModel: 'duration-hr' },
  football: { key: 'football', label: 'Voetbal',        icon: Activity,       colorBase: '#9CFF4F', colorLight: lt('156,255,79'),  loadModel: 'duration-hr' },
  yoga:     { key: 'yoga',     label: 'Yoga',           icon: PersonStanding, colorBase: '#7C3AED', colorLight: lt('124,58,237'),  loadModel: 'none' },
  cycle:    { key: 'cycle',    label: 'Fietsen',        icon: Bike,           colorBase: '#9CFF4F', colorLight: lt('156,255,79'),  loadModel: 'run-acwr' },
  swim:     { key: 'swim',     label: 'Zwemmen',        icon: Waves,          colorBase: '#4FC3F7', colorLight: lt('79,195,247'),  loadModel: 'duration-hr' },
  other:    { key: 'other',    label: 'Activiteit',     icon: Activity,       colorBase: '#A0A4B0', colorLight: lt('160,164,176'), loadModel: 'none' },
}

export const SPORT_KEYS = Object.keys(SPORT_META) as SportKey[]

export function sportMeta(key: SportKey): SportMeta {
  return SPORT_META[key] ?? SPORT_META.other
}
