import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/auth'
import { seedStefProfile } from '@/lib/profile/seed-stef-profile'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== process.env.PULSE_USER_ID) {
      return NextResponse.json({ error: 'Forbidden', code: 'OWNER_ONLY' }, { status: 403 })
    }

    const userId = getCurrentUserId()
    const { force } = await req.json().catch(() => ({ force: false }))

    const result = await seedStefProfile(userId, force === true)

    if (result.skipped) {
      return NextResponse.json({
        message: 'Profile already seeded. Use force:true to overwrite.',
        seeded: false,
        skipped: true,
      })
    }

    return NextResponse.json({
      message: 'Stef profile seeded successfully.',
      seeded: true,
      skipped: false,
    })
  } catch (err) {
    console.error('[seed-profile] Error:', err)
    return NextResponse.json({ error: 'Failed to seed profile' }, { status: 500 })
  }
}
