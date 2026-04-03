import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type BodyCompRow = Database['public']['Tables']['body_composition_logs']['Row']

export interface BodyCompEntry extends BodyCompRow {}

export interface BodyCompDelta {
  weight_kg: number | null
  muscle_mass_kg: number | null
  fat_mass_kg: number | null
  fat_pct: number | null
  waist_cm: number | null
}

const CreateBodyCompSchema = z.object({
  date: z.string().date(),
  source: z.enum(['inbody', 'manual', 'smart_scale']).default('inbody'),
  weight_kg: z.number().min(30).max(300),
  muscle_mass_kg: z.number().min(10).max(150).optional(),
  fat_mass_kg: z.number().min(0).max(150).optional(),
  fat_pct: z.number().min(0).max(80).optional(),
  bmi: z.number().min(10).max(60).optional(),
  waist_cm: z.number().min(40).max(200).optional(),
  chest_cm: z.number().min(40).max(200).optional(),
  arm_right_cm: z.number().min(10).max(100).optional(),
  thigh_right_cm: z.number().min(20).max(120).optional(),
  notes: z.string().max(500).optional(),
})

function computeDelta(current: BodyCompRow, previous: BodyCompRow): BodyCompDelta {
  return {
    weight_kg: current.weight_kg != null && previous.weight_kg != null
      ? Math.round((current.weight_kg - previous.weight_kg) * 100) / 100
      : null,
    muscle_mass_kg: current.muscle_mass_kg != null && previous.muscle_mass_kg != null
      ? Math.round((current.muscle_mass_kg - previous.muscle_mass_kg) * 100) / 100
      : null,
    fat_mass_kg: current.fat_mass_kg != null && previous.fat_mass_kg != null
      ? Math.round((current.fat_mass_kg - previous.fat_mass_kg) * 100) / 100
      : null,
    fat_pct: current.fat_pct != null && previous.fat_pct != null
      ? Math.round((current.fat_pct - previous.fat_pct) * 100) / 100
      : null,
    waist_cm: current.waist_cm != null && previous.waist_cm != null
      ? Math.round((current.waist_cm - previous.waist_cm) * 100) / 100
      : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limitParam = Number(searchParams.get('limit') ?? 10)
    const limit = Math.min(Math.max(1, limitParam), 50)

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('body_composition_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Body composition GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load body composition logs', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
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
    const parsed = CreateBodyCompSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige invoer', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: input } = parsed

    // Fetch previous entry (same source, earlier date) for delta calculation
    const { data: previousEntry } = await admin
      .from('body_composition_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('source', input.source)
      .lt('date', input.date)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    // Upsert the new entry (conflict on user_id, date, source)
    const { data: entry, error: upsertError } = await admin
      .from('body_composition_logs')
      .upsert(
        {
          user_id: user.id,
          date: input.date,
          source: input.source,
          weight_kg: input.weight_kg,
          muscle_mass_kg: input.muscle_mass_kg ?? null,
          fat_mass_kg: input.fat_mass_kg ?? null,
          fat_pct: input.fat_pct ?? null,
          bmi: input.bmi ?? null,
          waist_cm: input.waist_cm ?? null,
          chest_cm: input.chest_cm ?? null,
          arm_right_cm: input.arm_right_cm ?? null,
          thigh_right_cm: input.thigh_right_cm ?? null,
          notes: input.notes ?? null,
        },
        { onConflict: 'user_id,date,source' },
      )
      .select()
      .single()

    if (upsertError) throw upsertError

    // Compute delta vs previous entry
    const delta: BodyCompDelta = previousEntry
      ? computeDelta(entry, previousEntry)
      : { weight_kg: null, muscle_mass_kg: null, fat_mass_kg: null, fat_pct: null, waist_cm: null }

    return NextResponse.json(
      {
        entry,
        delta,
        previousDate: previousEntry?.date ?? null,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Body composition POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save body composition log', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
