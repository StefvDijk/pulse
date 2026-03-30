import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Navigation } from '@/components/layout/Navigation'
import { MiniChat } from '@/components/layout/MiniChat'
import { OnboardingCheck } from '@/components/settings/OnboardingCheck'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pulse',
  description: 'Persoonlijk health & training dashboard',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="nl" className={`${inter.className} h-full`}>
      <body className="min-h-full bg-bg-page">
        <Navigation />
        {/* Desktop: offset voor sidebar */}
        <main className="lg:pl-56 pb-24 lg:pb-0 min-h-screen">
          {children}
        </main>
        <MiniChat />
        <OnboardingCheck />
      </body>
    </html>
  )
}
