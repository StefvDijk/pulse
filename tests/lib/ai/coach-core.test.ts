import { describe, it, expect } from 'vitest'
import { buildCoachPersona } from '@/lib/ai/coach-core'

describe('buildCoachPersona', () => {
  it('declares the coach identity as expert, not pedagogue', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/wijze expert/i)
    // Persona must explicitly reject the Socratic-pedagogue framing
    expect(text).toMatch(/geen socratische pedagoog/i)
    // And must not present itself as a teaching coach via "wat denk je zelf"-style as default
    expect(text).not.toMatch(/wat denk je zelf(?!.*tenzij)/i)
  })

  it('includes the four core behaviours by name', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/cijfer-eerst/i)
    expect(text).toMatch(/memory-actief/i)
    expect(text).toMatch(/eerlijk waar het telt/i)
    expect(text).toMatch(/prestatie-erkenning/i)
  })

  it('forbids hype and filler explicitly', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/geen filler|geen hype|geen "great question/i)
  })

  it('allows measured praise like "goed gedaan" with constraints', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/goed gedaan/i)
    expect(text).toMatch(/niet bij elke beurt|bewaart kracht/i)
  })

  it('states explicit limits (no diagnosis, no caloriedoelen <1800)', () => {
    const text = buildCoachPersona()
    expect(text).toMatch(/geen diagnose/i)
    expect(text).toMatch(/1800 kcal/i)
  })

  it('instructs the model to emit the <cited_memories> tag verbatim (load-bearing contract)', () => {
    const text = buildCoachPersona()
    expect(text).toContain('<cited_memories>')
    expect(text).toContain('</cited_memories>')
  })
})
