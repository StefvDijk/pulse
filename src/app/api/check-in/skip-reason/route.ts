import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(['ziek', 'druk', 'rust', 'anders']),
  note: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { error } = await admin.from('skip_reasons').upsert(
      {
        user_id: user.id,
        date: parsed.data.date,
        reason: parsed.data.reason,
        note: parsed.data.note ?? null,
      },
      { onConflict: 'user_id,date' },
    )

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('skip-reason POST error:', error)
    return NextResponse.json({ error: 'Failed to save', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
