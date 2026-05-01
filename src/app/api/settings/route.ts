import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type UserSettingsRow = Database['public']['Tables']['user_settings']['Row']

type SafeUserSettings = Omit<
  UserSettingsRow,
  'google_calendar_access_token' | 'google_calendar_refresh_token' | 'google_calendar_token_expiry'
>

export interface SettingsData {
  profile: ProfileRow
  settings: SafeUserSettings
}

const ProfileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  weight_kg: z.number().positive().nullable().optional(),
  height_cm: z.number().positive().nullable().optional(),
  dietary_preference: z.enum(['omnivore', 'vegetarian', 'vegan']).nullable().optional(),
})

const SettingsUpdateSchema = z.object({
  hevy_api_key: z.string().nullable().optional(),
  health_auto_export_token: z.string().nullable().optional(),
  protein_target_per_kg: z.number().positive().nullable().optional(),
  weekly_training_target: z
    .object({
      gym: z.number().int().min(0).max(14),
      running: z.number().int().min(0).max(14),
      padel: z.number().int().min(0).max(14),
    })
    .nullable()
    .optional(),
  ai_custom_instructions: z.string().max(2000).nullable().optional(),
  coach_tone: z.enum(['direct', 'friendly', 'scientific']).optional(),
})

const PatchBodySchema = z.object({
  profile: ProfileUpdateSchema.optional(),
  settings: SettingsUpdateSchema.optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    // Data queries via admin client (SSR cookie-based client JWT not propagated to PostgREST)
    const admin = createAdminClient()

    const [profileResult, settingsResult] = await Promise.all([
      admin.from('profiles').select('*').eq('id', user.id).single(),
      admin
        .from('user_settings')
        .select(
          'user_id, hevy_api_key, health_auto_export_token, protein_target_per_kg, weekly_training_target, ai_custom_instructions, coach_tone, last_hevy_sync_at, last_apple_health_sync_at, google_calendar_email, preferred_unit_system, created_at, updated_at',
        )
        .eq('user_id', user.id)
        .single(),
    ])

    if (profileResult.error) throw profileResult.error
    if (settingsResult.error) throw settingsResult.error

    const data: SettingsData = {
      profile: profileResult.data,
      settings: settingsResult.data,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Failed to load settings', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = PatchBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    // Data queries via admin client (SSR cookie-based client JWT not propagated to PostgREST)
    const admin = createAdminClient()

    if (parsed.data.profile && Object.keys(parsed.data.profile).length > 0) {
      const { error: pErr } = await admin.from('profiles').update(parsed.data.profile).eq('id', user.id)
      if (pErr) throw pErr
    }

    if (parsed.data.settings && Object.keys(parsed.data.settings).length > 0) {
      const { error: sErr } = await admin.from('user_settings').update(parsed.data.settings).eq('user_id', user.id)
      if (sErr) throw sErr
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save settings', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
