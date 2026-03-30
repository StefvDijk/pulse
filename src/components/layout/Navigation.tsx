'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, TrendingUp, Utensils, BarChart2, MessageCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/progress', label: 'Progressie', icon: TrendingUp },
  { href: '/nutrition', label: 'Voeding', icon: Utensils },
  { href: '/trends', label: 'Trends', icon: BarChart2 },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
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
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        style={{ backgroundColor: '#12121a', borderTop: '1px solid #1a1a2e' }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center"
                style={{ color: isActive ? '#4f8cff' : '#8888a0' }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-xs">{label}</span>
              </Link>
            )
          })}
          <button
            onClick={handleSignOut}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] justify-center"
            style={{ color: '#8888a0' }}
          >
            <LogOut size={20} strokeWidth={1.8} />
            <span className="text-xs">Uit</span>
          </button>
        </div>
      </nav>

      {/* Sidebar — desktop */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 lg:left-0"
        style={{ backgroundColor: '#12121a', borderRight: '1px solid #1a1a2e' }}
      >
        <div className="flex items-center px-6 py-6" style={{ borderBottom: '1px solid #1a1a2e' }}>
          <span className="text-xl font-bold" style={{ color: '#f0f0f5' }}>
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: isActive ? '#1a1a2e' : 'transparent',
                  color: isActive ? '#f0f0f5' : '#8888a0',
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 space-y-1" style={{ borderTop: '1px solid #1a1a2e' }}>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: '#8888a0' }}
          >
            Instellingen
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-left hover:bg-[#1a1a2e]"
            style={{ color: '#8888a0' }}
          >
            <LogOut size={18} strokeWidth={1.8} />
            Uitloggen
          </button>
        </div>
      </aside>
    </>
  )
}
