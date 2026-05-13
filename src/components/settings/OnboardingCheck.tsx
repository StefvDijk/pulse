import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/auth'
import { OnboardingWizard } from './OnboardingWizard'

export async function OnboardingCheck() {
  let needsOnboarding = false

  try {
    // Skip on auth routes — wizard would otherwise overlay the login/signup page.
    const h = await headers()
    const pathname = h.get('x-pathname') ?? h.get('next-url') ?? ''
    if (pathname.startsWith('/auth')) return null

    const userId = getCurrentUserId()
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()

    needsOnboarding = !profile?.display_name?.trim()
  } catch {
    // Don't block rendering on errors — leave needsOnboarding = false.
  }

  return needsOnboarding ? <OnboardingWizard /> : null
}
