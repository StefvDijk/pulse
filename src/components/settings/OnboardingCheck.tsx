import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './OnboardingWizard'

export async function OnboardingCheck() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    // Show wizard if display_name is empty or just whitespace
    if (!profile?.display_name?.trim()) {
      return <OnboardingWizard />
    }
  } catch {
    // Don't block rendering on errors
  }

  return null
}
