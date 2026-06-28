import { describe, it, expect } from 'vitest'
import { resolveToolset } from '@/lib/ai/coaches/toolset'
import { createToolsForUser } from '@/lib/ai/tools'

describe('resolveToolset', () => {
  it('gives the manager every available tool', () => {
    const userId = 'user-1'
    const tools = resolveToolset('manager', userId)
    const allNames = Object.keys(createToolsForUser(userId)).sort()

    expect(allNames.length).toBeGreaterThan(0)
    expect(Object.keys(tools).sort()).toEqual(allNames)
  })
})
