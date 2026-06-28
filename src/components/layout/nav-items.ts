import {
  LayoutGrid,
  ClipboardList,
  HeartPulse,
  Apple,
  LineChart,
  CalendarCheck,
  Settings as SettingsIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

/**
 * Bottom-nav = the coach team (issue #39): each primary tab is the home base of
 * one coach. Home (manager), Schema (sportcoach), Gezondheid (gezondheidscoach),
 * Eten (diëtist). The generic "Coach" tab is gone — the manager IS Home — and
 * Progressie/Belasting/Doelen moved under Schema (see SchemaSubNav).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutGrid },
  { href: '/schema', label: 'Schema', icon: ClipboardList },
  { href: '/gezondheid', label: 'Gezondheid', icon: HeartPulse },
  { href: '/nutrition', label: 'Eten', icon: Apple },
]

export const MORE_ITEMS: NavItem[] = [
  { href: '/trends', label: 'Trends', icon: LineChart },
  { href: '/check-in/history', label: 'Check-in historie', icon: CalendarCheck },
  { href: '/settings', label: 'Instellingen', icon: SettingsIcon },
]

/** Training subscreens that now live under the Schema tab (see SchemaSubNav). */
export const SCHEMA_SUBSCREENS = ['/progress', '/belasting', '/goals']

/**
 * Whether a bottom-nav item should read as active for the current path. The
 * Schema tab owns its subscreens (Progressie/Belasting/Doelen), so those pages
 * keep the Schema tab lit instead of leaving the nav with no active tab.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href === '/schema') return SCHEMA_SUBSCREENS.includes(pathname)
  return false
}
