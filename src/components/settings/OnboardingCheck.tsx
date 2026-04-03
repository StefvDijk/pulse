import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/auth'
import { OnboardingWizard } from './OnboardingWizard'

export async function OnboardingCheck() {
  try {
    const userId = getCurrentUserId()
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()

    if (!profile?.display_name?.trim()) {
      return <OnboardingWizard />
    }
  } catch {
    // Don't block rendering on errors
  }

  return null
}
