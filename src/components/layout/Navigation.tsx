'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  LayoutGrid,
  TrendingUp,
  ClipboardList,
  MessageCircle,
  LogOut,
  Settings as SettingsIcon,
  Apple,
  MoreHorizontal,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { springLayout } from '@/lib/motion-presets'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutGrid },
  { href: '/schema', label: 'Schema', icon: ClipboardList },
  { href: '/progress', label: 'Progressie', icon: TrendingUp },
  { href: '/nutrition', label: 'Voeding', icon: Apple },
  { href: '/chat', label: 'Coach', icon: MessageCircle },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useBodyScrollLock(moreOpen)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ─── Bottom Tab Bar — mobile (Pulse v2 glass) ─────────────────── */}
      <nav
        className={[
          'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
          'flex items-stretch justify-around',
          'h-[var(--nav-height)]',
          'pt-2 pb-safe-12',
          'pl-safe pr-safe',
          'border-t border-bg-border-strong',
        ].join(' ')}
        style={{
          background: 'rgba(30,34,48,0.85)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
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
                'relative flex flex-col items-center justify-center gap-1',
                'min-w-[44px] flex-1 px-1',
                'active:opacity-60 transition-opacity duration-150',
                isActive ? 'text-text-primary' : 'text-text-tertiary',
              ].join(' ')}
            >
              <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-semibold tracking-[0.2px]">{label}</span>
              {isActive && (
                <span
                  className="absolute bottom-[18px] h-1 w-1 rounded-full"
                  style={{
                    background: 'var(--color-sport-gym-base)',
                    boxShadow: '0 0 8px var(--color-sport-gym-base)',
                  }}
                />
              )}
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Meer"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={[
            'relative flex flex-col items-center justify-center gap-1',
            'min-w-[44px] flex-1 px-1',
            'active:opacity-60 transition-opacity duration-150',
            moreOpen ? 'text-text-primary' : 'text-text-tertiary',
          ].join(' ')}
        >
          <MoreHorizontal size={22} strokeWidth={moreOpen ? 2 : 1.5} />
          <span className="text-[10px] font-semibold tracking-[0.2px]">Meer</span>
          {moreOpen && (
            <span
              className="absolute bottom-[18px] h-1 w-1 rounded-full"
              style={{
                background: 'var(--color-sport-gym-base)',
                boxShadow: '0 0 8px var(--color-sport-gym-base)',
              }}
            />
          )}
        </button>
      </nav>

      {/* ─── More sheet — mobile (Pulse v2) ───────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 z-[60] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Meer opties"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              className={[
                'absolute bottom-0 left-0 right-0',
                'bg-bg-elevated',
                'rounded-t-[28px]',
                'border-t border-bg-border-strong',
                'pb-safe-24',
              ].join(' ')}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              {/* Grabber */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="h-1 w-9 rounded-full bg-white/15" />
              </div>

              {/* Header */}
              <div className="px-5 pt-2 pb-3">
                <h2 className="text-[17px] font-semibold text-text-primary tracking-[-0.2px]">Meer</h2>
              </div>

              {/* List */}
              <div className="px-3 pb-3">
                <Link
                  href="/settings"
                  onClick={() => setMoreOpen(false)}
                  className={[
                    'flex items-center gap-3 px-3 py-3 rounded-xl',
                    'text-[15px] font-medium text-text-primary',
                    'hover:bg-white/[0.04] active:bg-white/[0.08]',
                    'transition-colors duration-150',
                  ].join(' ')}
                >
                  <SettingsIcon size={22} strokeWidth={1.5} className="text-text-secondary" />
                  <span className="flex-1">Instellingen</span>
                  <ChevronRight size={18} strokeWidth={1.5} className="text-text-muted" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false)
                    handleSignOut()
                  }}
                  className={[
                    'mt-1 flex w-full items-center gap-3 px-3 py-3 rounded-xl text-left',
                    'text-[15px] font-medium text-status-bad',
                    'hover:bg-status-bad/10 active:bg-status-bad/15',
                    'transition-colors duration-150',
                  ].join(' ')}
                >
                  <LogOut size={22} strokeWidth={1.5} />
                  <span>Uitloggen</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sidebar — desktop (Pulse v2 dark) ─────────────────────────── */}
      <aside
        className={[
          'hidden lg:flex lg:flex-col lg:w-56',
          'lg:fixed lg:inset-y-0 lg:left-0 lg:z-40',
          'bg-bg-surface',
          'border-r border-bg-border',
        ].join(' ')}
      >
        <div className="flex items-center px-6 py-6 border-b border-bg-border">
          <span className="text-[20px] font-bold tracking-tight text-text-primary">Pulse</span>
        </div>

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
                  'text-[15px] font-medium transition-colors duration-150',
                  isActive
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
                ].join(' ')}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: 'rgba(0,229,199,0.12)' }}
                    transition={springLayout}
                  />
                )}
                <Icon size={22} strokeWidth={1.5} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 space-y-1 border-t border-bg-border">
          <Link
            href="/settings"
            aria-current={pathname === '/settings' ? 'page' : undefined}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl',
              'text-[15px] font-medium transition-colors duration-150',
              pathname === '/settings'
                ? 'bg-white/[0.06] text-text-primary'
                : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
            ].join(' ')}
          >
            <SettingsIcon size={22} strokeWidth={1.5} />
            <span>Instellingen</span>
          </Link>
          <button
            onClick={handleSignOut}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left',
              'text-[15px] font-medium text-text-secondary',
              'hover:bg-white/[0.04] hover:text-text-primary',
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
