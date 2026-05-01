import type { Metadata, Viewport } from 'next'
import { Navigation } from '@/components/layout/Navigation'
import { MiniChat } from '@/components/layout/MiniChat'
import { OnboardingCheck } from '@/components/settings/OnboardingCheck'
import { TimeOfDayTheme } from '@/components/shared/TimeOfDayTheme'
import { SWRProvider } from '@/components/providers/SWRProvider'
import { InstallPrompt } from '@/components/shared/InstallPrompt'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pulse',
  description: 'Persoonlijk health & training dashboard',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pulse',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#15171F',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl" className="h-full dark">
      <body className="min-h-full bg-bg-grouped">
        <SWRProvider>
          <TimeOfDayTheme />
          <Navigation />
          {/* Desktop: offset voor sidebar. Mobile: ruimte voor 83px tab bar */}
          <main className="lg:pl-56 pb-[86px] lg:pb-0 min-h-[100dvh] pt-[env(safe-area-inset-top)]">
            {children}
          </main>
          <MiniChat />
          <OnboardingCheck />
          <InstallPrompt />
        </SWRProvider>
      </body>
    </html>
  )
}
