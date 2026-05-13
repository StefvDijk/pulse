import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { seedFoundationalMemory } from '@/lib/ai/seed-memory'

export async function POST(req: Request) {
  try {
    // Authenticated user required
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    // Single-user mode: only the owner may seed coaching memory.
    const ownerId = process.env.PULSE_USER_ID
    if (!ownerId || user.id !== ownerId) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }

    const { force } = await req.json().catch(() => ({ force: false }))

    const result = await seedFoundationalMemory(user.id, force === true)

    if (result.skipped) {
      return NextResponse.json({
        message: 'Coaching memory is already seeded. Use force:true to overwrite.',
        seeded: 0,
        skipped: true,
      })
    }

    return NextResponse.json({
      message: `Seeded ${result.seeded} foundational memory entries.`,
      seeded: result.seeded,
      skipped: false,
    })
  } catch (err) {
    console.error('[seed-memory] Error:', err)
    return NextResponse.json({ error: 'Failed to seed memory' }, { status: 500 })
  }
}
