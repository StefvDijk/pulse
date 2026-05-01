import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExplainTopicSchema } from '@/lib/explain/topics'
import { getTopic } from '@/lib/explain/registry'
import { streamChat, MODEL } from '@/lib/ai/client'
import { EXPLAIN_SYSTEM_PROMPT } from '@/lib/ai/prompts/explain/system'
import '@/lib/explain/topics/index'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ topic: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { topic: topicRaw } = await params
    const parsed = ExplainTopicSchema.safeParse(topicRaw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Unknown topic', code: 'BAD_TOPIC' }, { status: 400 })
    }

    const builder = getTopic(parsed.data)
    if (!builder) {
      return NextResponse.json({ error: 'Topic not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 })
    }

    const body = (await request.json().catch(() => ({}))) as { params?: Record<string, string> }
    const built = await builder.build(user.id, body.params ?? {})
    const userPrompt = builder.buildAiPrompt(built)

    const result = streamChat({
      system: EXPLAIN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      model: MODEL,
      maxOutputTokens: 350,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('explain ai route failed:', error)
    return NextResponse.json(
      { error: 'Failed to stream explanation', code: 'EXPLAIN_AI_FAILED' },
      { status: 500 },
    )
  }
}
