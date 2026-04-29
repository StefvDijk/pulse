import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { MEMORY_MODEL } from '@/lib/ai/client'
import { createClient } from '@/lib/supabase/server'

// Lightweight Anthropic API health check. Hits the cheapest model with a
// near-zero-token prompt so we can verify auth + connectivity without burning
// real money. Auth-required to prevent unauthenticated users from spending
// our Anthropic credits via this endpoint.
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  try {
    const { text } = await generateText({
      model: anthropic(MEMORY_MODEL),
      messages: [{ role: 'user', content: 'Reply with just: ok' }],
      maxOutputTokens: 5,
    })
    return NextResponse.json({
      ok: true,
      model: MEMORY_MODEL,
      latency_ms: Date.now() - start,
      response_preview: text.slice(0, 50),
    })
  } catch (err) {
    const e = err as { name?: string; statusCode?: number; message?: string }
    return NextResponse.json(
      {
        ok: false,
        latency_ms: Date.now() - start,
        error: {
          name: e?.name ?? 'UnknownError',
          statusCode: e?.statusCode,
          message: e?.message ?? String(err),
        },
      },
      { status: 503 },
    )
  }
}
