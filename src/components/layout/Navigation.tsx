'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, TrendingUp, Utensils, ClipboardList, MessageCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutGrid },
  { href: '/progress', label: 'Progressie', icon: TrendingUp },
  { href: '/schema', label: 'Schema', icon: ClipboardList },
  { href: '/nutrition', label: 'Voeding', icon: Utensils },
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
      {/* Bottom navigation — mobiel */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-bg-card border-t border-border-light">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center ${
                  isActive ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-xs">{label}</span>
              </Link>
            )
          })}
          <button
            onClick={handleSignOut}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center text-text-muted"
          >
            <LogOut size={20} strokeWidth={1.8} />
            <span className="text-xs">Uit</span>
          </button>
        </div>
      </nav>

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 lg:left-0 bg-bg-card border-r border-border-light">
        <div className="flex items-center px-6 py-6 border-b border-border-light">
          <span className="text-xl font-bold text-text-primary">
            Pulse
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-bg-subtle text-text-primary'
                    : 'text-text-tertiary hover:bg-bg-hover'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 space-y-1 border-t border-border-light">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-text-tertiary hover:bg-bg-hover"
          >
            Instellingen
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-left text-text-tertiary hover:bg-bg-subtle"
          >
            <LogOut size={18} strokeWidth={1.8} />
            Uitloggen
          </button>
        </div>
      </aside>
    </>
  )
}
