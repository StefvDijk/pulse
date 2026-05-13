import { describe, test, expect } from 'vitest'
import { compressHistory, type ChatTurn } from '@/lib/ai/history-compressor'

function makeTurn(role: ChatTurn['role'], content: string): ChatTurn {
  return { role, content }
}

describe('compressHistory — short-path (no compression)', () => {
  test('returns identical array when history is empty', async () => {
    const out = await compressHistory([])
    expect(out).toEqual([])
  })

  test('returns identical array when history has 1 turn', async () => {
    const turns = [makeTurn('user', 'hoi')]
    const out = await compressHistory(turns)
    expect(out).toEqual(turns)
  })

  test('returns identical array when history is exactly at threshold (16 turns)', async () => {
    const turns: ChatTurn[] = Array.from({ length: 16 }, (_, i) =>
      makeTurn(i % 2 === 0 ? 'user' : 'assistant', `turn ${i}`),
    )
    const out = await compressHistory(turns)
    expect(out).toHaveLength(16)
    expect(out).toEqual(turns)
  })
})

// NB: compression-on path (>=17 turns) is covered by the eval-harness +
// manual smoke test; mocking Anthropic SDK here would be overkill.
