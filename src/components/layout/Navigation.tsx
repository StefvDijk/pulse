'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  LayoutGrid,
  TrendingUp,
  ClipboardList,
  MessageCircle,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { springLayout } from '@/lib/motion-presets'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutGrid },
  { href: '/schema', label: 'Schema', icon: ClipboardList },
  { href: '/progress', label: 'Progressie', icon: TrendingUp },
  { href: '/chat', label: 'Coach', icon: MessageCircle },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ─── Bottom Tab Bar — mobiel (Apple HIG glass) ─────────────────── */}
      <nav
        className={[
          'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
          'bg-white/72 dark:bg-[#1C1C1E]/72',
          'backdrop-blur-xl backdrop-saturate-150',
          'border-t border-separator',
          'flex items-stretch justify-around',
          'h-[83px] pt-2 pb-[34px]',
        ].join(' ')}
        aria-label="Hoofdnavigatie"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex flex-col items-center justify-center gap-1',
                'min-w-[44px] flex-1 px-1',
                'transition-colors duration-150',
                'active:scale-90 transition-transform',
                isActive
                  ? 'text-system-blue'
                  : 'text-system-gray hover:text-label-primary',
              ].join(' ')}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span className="text-caption2 font-medium">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          aria-label="Uitloggen"
          className={[
            'flex flex-col items-center justify-center gap-1',
            'min-w-[44px] flex-1 px-1',
            'text-system-gray hover:text-label-primary',
            'transition-colors duration-150',
          ].join(' ')}
        >
          <LogOut size={22} strokeWidth={1.5} />
          <span className="text-caption2 font-medium">Uit</span>
        </button>
      </nav>

      {/* ─── Sidebar — desktop (iPadOS-style) ──────────────────────────── */}
      <aside
        className={[
          'hidden lg:flex lg:flex-col lg:w-56',
          'lg:fixed lg:inset-y-0 lg:left-0 lg:z-40',
          'bg-surface-primary',
          'border-r border-separator',
          'dark:bg-bg-secondary',
        ].join(' ')}
      >
        {/* Branding */}
        <div className="flex items-center px-6 py-6 border-b border-separator">
          <span className="text-title3 font-bold text-label-primary tracking-tight">
            Pulse
          </span>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Hoofdnavigatie">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl',
                  'text-subhead font-medium',
                  'transition-colors duration-150',
                  isActive
                    ? 'text-system-blue'
                    : 'text-label-secondary hover:bg-system-gray6 hover:text-label-primary',
                ].join(' ')}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-xl bg-system-blue/10"
                    transition={springLayout}
                  />
                )}
                <Icon size={22} strokeWidth={1.5} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer: settings + sign out */}
        <div className="px-3 py-4 space-y-1 border-t border-separator">
          <Link
            href="/settings"
            aria-current={pathname === '/settings' ? 'page' : undefined}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl',
              'text-subhead font-medium',
              'transition-colors duration-150',
              pathname === '/settings'
                ? 'bg-system-blue/10 text-system-blue'
                : 'text-label-secondary hover:bg-system-gray6 hover:text-label-primary',
            ].join(' ')}
          >
            <SettingsIcon size={22} strokeWidth={1.5} />
            <span>Instellingen</span>
          </Link>
          <button
            onClick={handleSignOut}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left',
              'text-subhead font-medium',
              'text-label-secondary hover:bg-system-gray6 hover:text-label-primary',
              'transition-colors duration-150',
            ].join(' ')}
          >
            <LogOut size={22} strokeWidth={1.5} />
            <span>Uitloggen</span>
          </button>
        </div>
      </aside>
    </>
  )
}
