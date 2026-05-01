import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExplainTopicSchema } from '@/lib/explain/topics'
import { getTopic, hashInputs } from '@/lib/explain/registry'
import '@/lib/explain/topics/index'

export async function GET(
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
    const topic = parsed.data

    const builder = getTopic(topic)
    if (!builder) {
      return NextResponse.json({ error: 'Topic not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 })
    }

    const url = new URL(request.url)
    const queryParams: Record<string, string> = {}
    for (const [k, v] of url.searchParams) queryParams[k] = v

    const built = await builder.build(user.id, queryParams)
    const inputsHash = hashInputs(built.inputs)

    return NextResponse.json({ ...built, topic, inputsHash })
  } catch (error) {
    console.error('explain route failed:', error)
    return NextResponse.json(
      { error: 'Failed to build explain payload', code: 'EXPLAIN_FAILED' },
      { status: 500 },
    )
  }
}
