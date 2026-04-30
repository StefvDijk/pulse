import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type CoachingMemoryUpdate = Database['public']['Tables']['coaching_memory']['Update']

const UpdateSchema = z.object({
  id: z.string().uuid(),
  value: z.string().min(1).max(500),
  category: z.string().optional(),
})

const DeleteSchema = z.object({
  id: z.string().uuid(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('coaching_memory')
      .select('id, category, key, value, source_date, updated_at')
      .eq('user_id', user.id)
      .order('category')
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ memories: data ?? [] })
  } catch (error) {
    console.error('Coaching memory GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load coaching memory', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const updates: CoachingMemoryUpdate = {
      value: parsed.data.value,
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.category) {
      updates.category = parsed.data.category
    }

    const { error } = await admin
      .from('coaching_memory')
      .update(updates)
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Coaching memory PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update memory', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('coaching_memory')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Coaching memory DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete memory', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
