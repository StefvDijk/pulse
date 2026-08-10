import { beforeEach, describe, expect, it, vi } from 'vitest'
import { after } from 'next/server'
import { runAfterResponse } from '@/lib/runtime/after-response'

vi.mock('next/server', () => ({ after: vi.fn() }))

describe('runAfterResponse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers work with Next after instead of starting it immediately', async () => {
    const task = vi.fn().mockResolvedValue(undefined)

    runAfterResponse('memory extraction', task)

    expect(task).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledOnce()

    const scheduled = vi.mocked(after).mock.calls[0][0] as () => Promise<void>
    await scheduled()

    expect(task).toHaveBeenCalledOnce()
  })

  it('contains and labels background failures', async () => {
    const error = new Error('write failed')
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    runAfterResponse('belief extraction', async () => {
      throw error
    })
    const scheduled = vi.mocked(after).mock.calls[0][0] as () => Promise<void>

    await expect(scheduled()).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('[after] belief extraction failed:', error)
  })
})
