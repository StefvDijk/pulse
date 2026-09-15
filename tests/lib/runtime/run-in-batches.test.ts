import { describe, expect, it, vi } from 'vitest'
import { runInBatches } from '@/lib/runtime/run-in-batches'

describe('runInBatches', () => {
  it('never starts more than one bounded batch at a time', async () => {
    let active = 0
    let maxActive = 0
    const releases: Array<() => void> = []

    const resultPromise = runInBatches([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active -= 1
      return value * 2
    })

    await vi.waitFor(() => expect(releases).toHaveLength(2))
    releases.splice(0, 2).forEach((release) => release())
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    releases.splice(0, 2).forEach((release) => release())
    await vi.waitFor(() => expect(releases).toHaveLength(1))
    releases.shift()?.()

    const results = await resultPromise
    expect(maxActive).toBe(2)
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ])
  })

  it('continues with later batches when one task rejects', async () => {
    const seen: number[] = []

    const results = await runInBatches([1, 2, 3], 2, async (value) => {
      seen.push(value)
      if (value === 2) throw new Error('bad belief')
      return value
    })

    expect(seen).toEqual([1, 2, 3])
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ])
  })

  it('rejects an invalid batch size', async () => {
    await expect(runInBatches([1], 0, async (value) => value)).rejects.toThrow(
      'batchSize must be a positive integer',
    )
  })
})
