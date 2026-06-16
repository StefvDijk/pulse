import { describe, it, expect, vi } from 'vitest'
import { softRows } from '@/lib/supabase/soft-rows'

describe('softRows', () => {
  it('geeft de rijen terug bij succes', () => {
    expect(softRows({ data: [{ id: 1 }, { id: 2 }], error: null }, 'test')).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('valt terug op [] bij een query-fout (i.p.v. throwen) en logt', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rows = softRows({ data: null, error: { message: 'relation "x" does not exist' } }, 'test:activities')
    expect(rows).toEqual([])
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it('valt terug op [] wanneer data null is zonder fout', () => {
    expect(softRows({ data: null, error: null }, 'test')).toEqual([])
  })
})
