import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, createAdminMock, runCoachMock, thinContextMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminMock: vi.fn(),
  runCoachMock: vi.fn(),
  thinContextMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClientMock() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminMock() }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true, resetMs: 0 }) }))
vi.mock('@/lib/ai/context-assembler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/context-assembler')>()
  return { ...actual, assembleThinContext: thinContextMock }
})
vi.mock('@/lib/profile/build-profile-block', () => ({
  loadUserProfile: vi.fn(async () => null),
  renderProfileBlock: vi.fn(() => null),
}))
vi.mock('@/lib/ai/coaches/run-coach', () => ({ runCoach: runCoachMock }))
vi.mock('@/lib/runtime/after-response', () => ({ runAfterResponse: vi.fn() }))

import { POST } from '@/app/api/chat/route'

const USER_ID = '10000000-0000-4000-8000-000000000001'
const SESSION_ID = '20000000-0000-4000-8000-000000000001'
const TURN_ID = '30000000-0000-4000-8000-000000000001'

interface HarnessOptions {
  failFirstAssistant?: boolean
  initialAssistant?: { content: string; cards: unknown[] }
  sessionInitialTurnId?: string | null
}

function createHarness(options: HarnessOptions = {}) {
  let status: 'pending' | 'processing' | 'completed' = options.initialAssistant
    ? 'completed'
    : 'pending'
  let leaseCounter = 0
  let leaseToken: string | null = null
  let generatedResponse: string | null = null
  let assistant: { content: string; cards: unknown[] } | null = options.initialAssistant ?? null
  let assistantUpserts = 0
  let seedUpserts = 0
  const events: string[] = []

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'resolve_chat_session_for_turn') {
      return { data: { id: SESSION_ID, coach_id: 'manager' }, error: null }
    }
    if (name === 'claim_chat_turn') {
      if (status === 'completed') {
        return {
          data: { claimed: false, completed: true, lease_token: null, retry_after_ms: 0 },
          error: null,
        }
      }
      if (status === 'processing') {
        return {
          data: { claimed: false, completed: false, lease_token: null, retry_after_ms: 90_000 },
          error: null,
        }
      }
      status = 'processing'
      leaseCounter += 1
      leaseToken = `40000000-0000-4000-8000-${String(leaseCounter).padStart(12, '0')}`
      return {
        data: { claimed: true, completed: false, lease_token: leaseToken, retry_after_ms: 0 },
        error: null,
      }
    }
    if (name === 'store_chat_turn_response') {
      events.push('store-intent')
      generatedResponse ??= args.p_generated_response as string
      return { data: args.p_lease_token === leaseToken, error: null }
    }
    if (name === 'complete_chat_turn') {
      status = 'completed'
      leaseToken = null
      return { data: true, error: null }
    }
    if (name === 'abandon_chat_turn') {
      status = 'pending'
      leaseToken = null
      return { data: true, error: null }
    }
    throw new Error(`Unexpected RPC: ${name}`)
  })

  function builder(table: string) {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'neq', 'order', 'limit', 'or']) {
      chain[method] = vi.fn(() => chain)
    }
    chain.maybeSingle = vi.fn(async () => {
      if (table === 'chat_sessions') {
        return {
          data: {
            coach_id: 'manager',
            initial_turn_id: options.sessionInitialTurnId ?? TURN_ID,
          },
          error: null,
        }
      }
      if (table === 'chat_messages') return { data: assistant, error: null }
      if (table === 'training_schemas' || table === 'user_settings') {
        return { data: null, error: null }
      }
      throw new Error(`Unexpected maybeSingle table: ${table}`)
    })
    chain.single = vi.fn(async () => {
      if (table === 'chat_turn_executions') {
        return { data: { generated_response: generatedResponse }, error: null }
      }
      throw new Error(`Unexpected single table: ${table}`)
    })
    chain.upsert = vi.fn(async (payload: unknown) => {
      if (Array.isArray(payload)) {
        seedUpserts += payload.filter(
          (row) => (row as { message_type?: string }).message_type === 'coach_nudge',
        ).length
      }
      const row = Array.isArray(payload)
        ? null
        : (payload as { role?: string; content?: string; cards?: unknown[] })
      if (table === 'chat_messages' && row?.role === 'assistant') {
        assistantUpserts += 1
        events.push('assistant-upsert')
        if (options.failFirstAssistant && assistantUpserts === 1) {
          return { data: null, error: { message: 'forced assistant failure' } }
        }
        assistant = { content: row.content ?? '', cards: row.cards ?? [] }
      }
      return { data: null, error: null }
    })
    chain.then = (resolve: (result: { data: unknown; error: null }) => unknown) => {
      const data =
        table === 'injury_logs' || table === 'goals' || table === 'chat_messages' ? [] : null
      return resolve({ data, error: null })
    }
    return chain
  }

  return {
    admin: { rpc, from: vi.fn((table: string) => builder(table)) },
    events,
    get assistantUpserts() {
      return assistantUpserts
    },
    get generatedResponse() {
      return generatedResponse
    },
    get seedUpserts() {
      return seedUpserts
    },
  }
}

function request(options: { newSession?: boolean; seed?: string } = {}) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Geef kort advies',
      ...(options.newSession ? {} : { session_id: SESSION_ID }),
      coach_id: 'manager',
      turn_id: TURN_ID,
      ...(options.seed ? { seed_assistant: options.seed } : {}),
    }),
  })
}

beforeEach(() => {
  createClientMock.mockReset().mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } } })) },
  })
  createAdminMock.mockReset()
  runCoachMock.mockReset().mockResolvedValue({
    textStream: (async function* () {
      yield 'Duurzaam antwoord'
    })(),
    usage: Promise.resolve({ outputTokens: 3 }),
  })
  thinContextMock.mockReset().mockResolvedValue('context')
})

describe('POST /api/chat durable turn orchestration', () => {
  it('allows at most one provider call for concurrent requests with the same turn id', async () => {
    let releaseContext!: (value: string) => void
    thinContextMock.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseContext = resolve
      }),
    )
    const harness = createHarness()
    createAdminMock.mockReturnValue(harness.admin)

    const first = await POST(request())
    const concurrent = await POST(request())
    expect(concurrent.status).toBe(409)

    releaseContext('context')
    expect(await first.text()).toContain('Duurzaam antwoord')
    expect(runCoachMock).toHaveBeenCalledTimes(1)
  })

  it('reuses stored model intent after assistant persistence fails', async () => {
    const harness = createHarness({ failFirstAssistant: true })
    createAdminMock.mockReturnValue(harness.admin)

    const failed = await POST(request())
    expect(await failed.text()).toContain('AI_GENERIC_ERROR')
    expect(harness.generatedResponse).toBe('Duurzaam antwoord')

    const retry = await POST(request())
    expect(await retry.text()).toContain('Duurzaam antwoord')
    expect(runCoachMock).toHaveBeenCalledTimes(1)
    expect(harness.assistantUpserts).toBe(2)
    expect(harness.events.indexOf('store-intent')).toBeLessThan(
      harness.events.indexOf('assistant-upsert'),
    )
  })

  it('resolves a first-turn retry to one session and persists its seed once', async () => {
    const harness = createHarness()
    createAdminMock.mockReturnValue(harness.admin)

    const first = await POST(request({ newSession: true, seed: 'Welkom terug' }))
    expect(await first.text()).toContain('Duurzaam antwoord')
    const replay = await POST(request({ newSession: true, seed: 'Welkom terug' }))
    expect(replay.headers.get('X-Chat-Replayed')).toBe('true')
    expect(await replay.text()).toContain('Duurzaam antwoord')
    expect(runCoachMock).toHaveBeenCalledTimes(1)
    expect(harness.seedUpserts).toBe(1)
  })

  it('keeps the opening seed when its retry already knows the session id', async () => {
    thinContextMock.mockRejectedValueOnce(new Error('forced pre-insert failure'))
    const harness = createHarness()
    createAdminMock.mockReturnValue(harness.admin)

    const failed = await POST(request({ newSession: true, seed: 'Welkom terug' }))
    expect(await failed.text()).toContain('AI_GENERIC_ERROR')
    expect(harness.seedUpserts).toBe(0)

    const retry = await POST(request({ seed: 'Welkom terug' }))
    expect(await retry.text()).toContain('Duurzaam antwoord')
    expect(harness.seedUpserts).toBe(1)
    expect(runCoachMock).toHaveBeenCalledTimes(1)
  })

  it('ignores a stale opening seed on a later-turn retry', async () => {
    const harness = createHarness({
      failFirstAssistant: true,
      sessionInitialTurnId: '30000000-0000-4000-8000-000000000099',
    })
    createAdminMock.mockReturnValue(harness.admin)

    const failed = await POST(request())
    expect(await failed.text()).toContain('AI_GENERIC_ERROR')
    const retry = await POST(request({ seed: 'Verouderde seed' }))
    expect(await retry.text()).toContain('Duurzaam antwoord')
    expect(harness.seedUpserts).toBe(0)

    const fingerprints = harness.admin.rpc.mock.calls
      .filter(([name]) => name === 'claim_chat_turn')
      .map(([, args]) => args.p_request_fingerprint)
    expect(fingerprints).toHaveLength(2)
    expect(fingerprints[0]).toBe(fingerprints[1])
  })

  it('replays exact terminal text and cards without invoking the provider', async () => {
    const card = { type: 'stat_card', label: 'Load', value: '42' }
    const harness = createHarness({
      initialAssistant: { content: 'Exact opgeslagen antwoord', cards: [card] },
    })
    createAdminMock.mockReturnValue(harness.admin)

    const replay = await POST(request())
    const body = await replay.text()
    expect(replay.headers.get('X-Chat-Replayed')).toBe('true')
    expect(body).toContain('Exact opgeslagen antwoord')
    expect(body).toContain(JSON.stringify({ __card: card }))
    expect(runCoachMock).not.toHaveBeenCalled()
  })
})
