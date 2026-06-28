'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * SchemaSubNav — the training domain's sub-navigation (issue #39). Progressie,
 * Belasting and Doelen are now subscreens under Schema (the sportcoach's tab)
 * instead of top-level bottom-nav entries. A scrollable pill row that lets Stef
 * jump between the four training views.
 */
const SUB_ITEMS = [
  { href: '/schema', label: 'Schema' },
  { href: '/progress', label: 'Progressie' },
  { href: '/belasting', label: 'Belasting' },
  { href: '/goals', label: 'Doelen' },
] as const

export function SchemaSubNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Schema-subnavigatie"
      className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SUB_ITEMS.map(({ href, label }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary',
            ].join(' ')}
            style={isActive ? { background: 'var(--color-sport-gym-light)' } : undefined}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
