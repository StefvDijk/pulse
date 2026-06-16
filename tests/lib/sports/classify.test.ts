import { describe, it, expect } from 'vitest'
import { classifySport } from '@/lib/sports/classify'

describe('classifySport', () => {
  it('herkent hardlopen (NL+EN, Apple+Strava)', () => {
    expect(classifySport('Outdoor Run', 'strava')).toBe('run')
    expect(classifySport('Hardlopen', 'apple')).toBe('run')
    expect(classifySport('Loopband', 'apple')).toBe('run')
    expect(classifySport('TrailRun', 'strava')).toBe('run')
  })
  it('herkent wandelen/hiken', () => {
    expect(classifySport('Walk', 'strava')).toBe('walk')
    expect(classifySport('Hiking', 'apple')).toBe('walk')
    expect(classifySport('Wandelen', 'apple')).toBe('walk')
  })
  it('scheidt racketsporten correct — tennis ≠ padel ≠ squash', () => {
    expect(classifySport('Tennis', 'apple')).toBe('tennis')
    expect(classifySport('Padel', 'apple')).toBe('padel')
    expect(classifySport('Squash', 'apple')).toBe('squash')
  })
  it('herkent gym als kracht, niet als hiit', () => {
    expect(classifySport('Traditional Strength Training', 'apple')).toBe('gym')
    expect(classifySport('Functional Strength Training', 'apple')).toBe('gym')
    expect(classifySport('Krachttraining', 'apple')).toBe('gym')
  })
  it('herkent hiit / voetbal / yoga / fietsen / zwemmen', () => {
    expect(classifySport('High Intensity Interval Training', 'apple')).toBe('hiit')
    expect(classifySport('Soccer', 'strava')).toBe('football')
    expect(classifySport('Voetbal', 'apple')).toBe('football')
    expect(classifySport('Yoga', 'apple')).toBe('yoga')
    expect(classifySport('Ride', 'strava')).toBe('cycle')
    expect(classifySport('Cycling', 'apple')).toBe('cycle')
    expect(classifySport('Pool Swim', 'apple')).toBe('swim')
  })
  it('valt terug op other bij onbekend', () => {
    expect(classifySport('Curling', 'apple')).toBe('other')
    expect(classifySport('', 'apple')).toBe('other')
  })
})
