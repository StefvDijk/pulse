import type { Metadata, Viewport } from 'next'
import { Navigation } from '@/components/layout/Navigation'
import { MiniChat } from '@/components/layout/MiniChat'
import { OnboardingCheck } from '@/components/settings/OnboardingCheck'
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
        <Navigation />
        {/* Desktop: offset voor sidebar. Mobile: ruimte voor 83px tab bar */}
        <main className="lg:pl-56 pb-[83px] lg:pb-0 min-h-screen">
          {children}
        </main>
        <MiniChat />
        <OnboardingCheck />
      </body>
    </html>
  )
}
