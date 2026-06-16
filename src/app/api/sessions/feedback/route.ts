import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SaveSessionFeedbackSchema } from '@/lib/training/session-feedback-contract'
import type { SessionFeedbackType } from '@/lib/training/session-feedback'

type AdminClient = ReturnType<typeof createAdminClient>

// Persist (or dismiss) a user's free-text feedback for one imported session.
// Upserts on (user_id, session_type, session_id) so re-opening the sheet edits
// in place. The session's title + start time are snapshotted server-side from
// the authoritative table — never trusted from the client — which also doubles
// as the ownership check (the row must belong to this user).

interface ResolvedSession {
  title: string
  started_at: string
}

async function resolveSession(
  admin: AdminClient,
  userId: string,
  type: SessionFeedbackType,
  id: string,
): Promise<ResolvedSession | null> {
  if (type === 'gym') {
    const { data } = await admin
      .from('workouts')
      .select('title, started_at')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    return data ? { title: data.title, started_at: data.started_at } : null
  }
  if (type === 'run') {
    const { data } = await admin
      .from('runs')
      .select('run_type, started_at')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    const title = data.run_type
      ? `${data.run_type.charAt(0).toUpperCase()}${data.run_type.slice(1)} run`
      : 'Hardlopen'
    return { title, started_at: data.started_at }
  }
  // padel
  const { data } = await admin
    .from('padel_sessions')
    .select('started_at')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  return data ? { title: 'Padel', started_at: data.started_at } : null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body: unknown = await request.json().catch(() => null)
    const parsed = SaveSessionFeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ongeldige aanvraag', code: 'VALIDATION_ERROR', issues: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { session_type, session_id, feedback_text, dismissed } = parsed.data

    const admin = createAdminClient()
    const session = await resolveSession(admin, user.id, session_type, session_id)
    if (!session) {
      return NextResponse.json(
        { error: 'Sessie niet gevonden', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    const text = feedback_text && feedback_text.length > 0 ? feedback_text : null

    const { data, error } = await admin
      .from('session_feedback')
      .upsert(
        {
          user_id: user.id,
          session_type,
          session_id,
          session_title: session.title,
          session_started_at: session.started_at,
          feedback_text: text,
          dismissed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_type,session_id' },
      )
      .select('id, session_type, session_id, feedback_text, dismissed')
      .single()

    if (error || !data) {
      console.error('[sessions/feedback] upsert failed:', error)
      return NextResponse.json({ error: 'Opslaan mislukt', code: 'DB_ERROR' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[sessions/feedback] unexpected error:', err)
    return NextResponse.json({ error: 'Onverwachte fout', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
