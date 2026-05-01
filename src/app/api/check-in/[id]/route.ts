import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

const PatchSchema = z.object({
  summary_text: z.string().min(1).max(2000).optional(),
  focus_next_week: z.string().min(1).max(500).optional(),
  notes_text: z.string().max(2000).nullable().optional(),
  wellness_energy: z.number().int().min(1).max(5).nullable().optional(),
  wellness_motivation: z.number().int().min(1).max(5).nullable().optional(),
  wellness_stress: z.number().int().min(1).max(5).nullable().optional(),
  previous_focus_rating: z.enum(['gehaald', 'deels', 'niet']).nullable().optional(),
  previous_focus_note: z.string().max(500).nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Read existing record so we can preserve next_week_plan (focus lives nested)
    const { data: existing, error: readError } = await admin
      .from('weekly_reviews')
      .select('user_id, next_week_plan')
      .eq('id', id)
      .single()

    if (readError || !existing) {
      return NextResponse.json({ error: 'Niet gevonden', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.summary_text !== undefined) updates.summary_text = parsed.data.summary_text
    if (parsed.data.notes_text !== undefined) updates.notes_text = parsed.data.notes_text
    if (parsed.data.wellness_energy !== undefined) updates.wellness_energy = parsed.data.wellness_energy
    if (parsed.data.wellness_motivation !== undefined) updates.wellness_motivation = parsed.data.wellness_motivation
    if (parsed.data.wellness_stress !== undefined) updates.wellness_stress = parsed.data.wellness_stress
    if (parsed.data.previous_focus_rating !== undefined) updates.previous_focus_rating = parsed.data.previous_focus_rating
    if (parsed.data.previous_focus_note !== undefined) updates.previous_focus_note = parsed.data.previous_focus_note

    // focus_next_week is nested in next_week_plan JSON
    if (parsed.data.focus_next_week !== undefined) {
      const plan = (existing.next_week_plan as Record<string, unknown> | null) ?? {}
      updates.next_week_plan = { ...plan, focusNextWeek: parsed.data.focus_next_week } as Json
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Niets om te updaten', code: 'NO_OP' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await admin
      .from('weekly_reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError
    return NextResponse.json(updated)
  } catch (error) {
    console.error('check-in PATCH error:', error)
    return NextResponse.json({ error: 'Update mislukt', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('weekly_reviews')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Niet gevonden', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (data.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('check-in GET error:', error)
    return NextResponse.json({ error: 'Laden mislukt', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
