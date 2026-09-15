import { describe, expect, it } from 'vitest'
import { canAdvanceFullSyncPage } from '@/lib/hevy/full-sync-cursor'

describe('full Hevy sync cursor', () => {
  it('advances only when the complete page added no errors', () => {
    expect(canAdvanceFullSyncPage(2, 2)).toBe(true)
    expect(canAdvanceFullSyncPage(2, 3)).toBe(false)
  })
})
