import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPrompt } from '@/lib/ai/prompts/chat-system'
import { assembleThinContext } from '@/lib/ai/context-assembler'
import { loadUserProfile, renderProfileBlock } from '@/lib/profile/build-profile-block'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()

    const [thinContext, schemaResult, injuriesResult, goalsResult, settingsResult, profile] = await Promise.all([
      assembleThinContext(user.id),
      admin
        .from('training_schemas')
        .select('title, schema_type, weeks_planned, start_date')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
      admin
        .from('injury_logs')
        .select('body_location, severity, description, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(10),
      admin
        .from('goals')
        .select('title, category, target_value, current_value, deadline')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .limit(10),
      admin
        .from('user_settings')
        .select('ai_custom_instructions, coach_tone')
        .eq('user_id', user.id)
        .maybeSingle(),
      loadUserProfile(user.id),
    ])

    const activeSchema = schemaResult.data
      ? {
          ...schemaResult.data,
          current_week: schemaResult.data.start_date
            ? Math.ceil((Date.now() - new Date(schemaResult.data.start_date).getTime()) / (7 * 86_400_000)) + 1
            : undefined,
        }
      : null

    const customInstructions = settingsResult.data?.ai_custom_instructions ?? null
    const coachTone = (settingsResult.data?.coach_tone ?? 'direct') as 'direct' | 'friendly' | 'scientific'

    const systemPrompt = buildSystemPrompt({
      activeSchema,
      activeInjuries: injuriesResult.data ?? [],
      activeGoals: goalsResult.data ?? [],
      customInstructions,
      coachTone,
      profileBlock: renderProfileBlock(profile),
    })

    const totalChars = systemPrompt.length + thinContext.length

    return NextResponse.json({
      systemPrompt,
      customInstructions,
      thinContext,
      totalChars,
    })
  } catch (error) {
    console.error('AI context preview error:', error)
    return NextResponse.json(
      { error: 'Failed to build context preview', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
