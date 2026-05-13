import { describe, it, expect } from 'vitest'
import {
  sheetPresentation,
  glassFade,
  pageControl,
} from '@/lib/motion-presets'

describe('motion-presets — iOS 26 additions', () => {
  it('sheetPresentation slides up from bottom', () => {
    expect(sheetPresentation.initial).toMatchObject({ y: '100%' })
    expect(sheetPresentation.animate).toMatchObject({ y: 0 })
    expect(sheetPresentation.exit).toMatchObject({ y: '100%' })
  })

  it('glassFade animates blur and opacity', () => {
    expect(glassFade.initial).toMatchObject({ opacity: 0 })
    expect(glassFade.animate).toMatchObject({ opacity: 1 })
    expect((glassFade.animate as Record<string, unknown>).backdropFilter)
      .toMatch(/blur\(28px\)/)
  })

  it('pageControl has inactive and active states', () => {
    expect(pageControl.inactive).toMatchObject({ scale: 1, opacity: 0.46 })
    expect(pageControl.active).toMatchObject({ scale: 1.15, opacity: 1 })
  })
})
