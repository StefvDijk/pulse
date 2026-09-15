import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateTextMock, streamTextMock, logAiUsageMock, runAfterResponseMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  streamTextMock: vi.fn(),
  logAiUsageMock: vi.fn(async (...args: unknown[]) => { void args }),
  runAfterResponseMock: vi.fn((_label: string, task: () => Promise<unknown>) => task()),
}))

const reservation = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  userId: '11111111-2222-4333-8444-555555555555',
  estimatedCostUsd: 2.16,
}

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  streamText: (...args: unknown[]) => streamTextMock(...args),
  stepCountIs: vi.fn(() => 'stop-condition'),
}))
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn(() => ({ name: 'mocked' })) }))
vi.mock('@/lib/ai/budget', () => ({ reserveAiBudget: vi.fn(async () => reservation) }))
vi.mock('@/lib/ai/usage', () => ({ logAiUsage: logAiUsageMock }))
vi.mock('@/lib/runtime/after-response', () => ({ runAfterResponse: runAfterResponseMock }))

import { createJsonCompletion, streamChat } from '@/lib/ai/client'

beforeEach(() => {
  generateTextMock.mockReset()
  streamTextMock.mockReset()
  logAiUsageMock.mockClear()
  runAfterResponseMock.mockClear()
})

describe('AI budget settlement on provider failures', () => {
  it('settles the conservative reservation when generateText rejects without usage', async () => {
    generateTextMock.mockRejectedValue(new Error('provider down'))

    await expect(createJsonCompletion({
      system: 'system',
      userMessage: 'hello',
      meta: { userId: reservation.userId, feature: 'test-json' },
    })).rejects.toThrow('provider down')

    expect(logAiUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      reservation,
    }))
    expect(logAiUsageMock.mock.calls[0]?.[0]).not.toHaveProperty('usage')
  })

  it('settles the conservative reservation when lazy stream usage rejects', async () => {
    streamTextMock.mockReturnValue({ usage: Promise.reject(new Error('stream interrupted')) })

    await streamChat({
      system: 'system',
      messages: [{ role: 'user', content: 'hello' }],
      meta: { userId: reservation.userId, feature: 'test-stream' },
    })
    await vi.waitFor(() => expect(logAiUsageMock).toHaveBeenCalled())

    expect(logAiUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      reservation,
    }))
    expect(logAiUsageMock.mock.calls[0]?.[0]).not.toHaveProperty('usage')
  })
})
