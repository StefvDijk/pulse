import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { seedStefProfile } from '@/lib/profile/seed-stef-profile'

export async function POST(req: Request) {
  try {
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
