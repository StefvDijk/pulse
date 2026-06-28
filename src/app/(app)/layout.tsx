import { Navigation } from '@/components/layout/Navigation'
import { OnboardingCheck } from '@/components/settings/OnboardingCheck'
import { TimeOfDayTheme } from '@/components/shared/TimeOfDayTheme'
import { SWRProvider } from '@/components/providers/SWRProvider'
import { InstallPrompt } from '@/components/shared/InstallPrompt'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SWRProvider>
      <TimeOfDayTheme />
      <Navigation />
      {/* Desktop: offset voor sidebar. Mobile: ruimte voor dynamische tab bar incl. safe-area-bottom. */}
      <main className="lg:pl-56 pb-[var(--nav-height)] min-h-[100dvh] pt-safe pl-safe pr-safe">
        {children}
      </main>
      <OnboardingCheck />
      <InstallPrompt />
    </SWRProvider>
  )
}
