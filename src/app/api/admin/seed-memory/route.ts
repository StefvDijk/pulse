import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth'
import { seedFoundationalMemory } from '@/lib/ai/seed-memory'

export async function POST(req: Request) {
  try {
    const userId = getCurrentUserId()
    const { force } = await req.json().catch(() => ({ force: false }))

    const result = await seedFoundationalMemory(userId, force === true)

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
