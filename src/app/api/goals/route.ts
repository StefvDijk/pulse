import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const CreateGoalSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(['strength', 'running', 'padel', 'nutrition', 'general']),
  target_value: z.number().positive().nullable().optional(),
  target_unit: z.string().max(50).nullable().optional(),
  target_type: z.enum(['max', 'min', 'count']),
  deadline: z.string().date().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Goals GET error:', error)
    return NextResponse.json({ error: 'Failed to load goals', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateGoalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        category: parsed.data.category,
        target_value: parsed.data.target_value ?? null,
        target_unit: parsed.data.target_unit ?? null,
        target_type: parsed.data.target_type,
        deadline: parsed.data.deadline ?? null,
        description: parsed.data.description ?? null,
        status: 'active',
        current_value: 0,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Goals POST error:', error)
    return NextResponse.json({ error: 'Failed to create goal', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
