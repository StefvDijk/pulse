import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/schema' }))

import { SchemaSubNav } from '@/components/schema/SchemaSubNav'

afterEach(() => cleanup())

describe('SchemaSubNav — Progressie/Belasting/Doelen under Schema (issue #39)', () => {
  it('links to the schema subscreens', () => {
    const { getAllByRole } = render(<SchemaSubNav />)
    const hrefs = getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/schema', '/progress', '/belasting', '/goals']))
  })
})
