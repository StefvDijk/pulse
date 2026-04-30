import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type GoalUpdate = Database['public']['Tables']['goals']['Update']

const UpdateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.enum(['strength', 'running', 'padel', 'nutrition', 'general']).optional(),
  target_value: z.number().positive().nullable().optional(),
  target_unit: z.string().max(50).nullable().optional(),
  target_type: z.enum(['max', 'min', 'count']).optional(),
  deadline: z.string().date().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  current_value: z.number().nonnegative().nullable().optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = UpdateGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const updateData: GoalUpdate = { ...parsed.data }
    if (parsed.data.status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    // Data queries via admin client (SSR cookie-based client JWT not propagated to PostgREST)
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('goals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Doel niet gevonden', code: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Goals PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update goal', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params

    // Data queries via admin client (SSR cookie-based client JWT not propagated to PostgREST)
    const admin = createAdminClient()

    const { error } = await admin
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Goals DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete goal', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
