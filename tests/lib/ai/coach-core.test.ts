import { describe, it, expect, vi } from 'vitest'
import { buildCoachPersona, buildKnowledgeBase, buildMemoryReadBlock } from '@/lib/ai/coach-core'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: '11111111-2222-3333-4444-555555555555',
                      category: 'preference',
                      value: "Stef traint het liefst 's ochtends",
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  })),
}))

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

describe('buildKnowledgeBase', () => {
  it('includes Israetel volume landmarks (MV/MEV/MAV/MRV)', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/MV.*MEV.*MAV.*MRV/i)
  })

  it('includes ACWR safety band 0.8-1.3', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/ACWR/i)
    expect(text).toMatch(/0\.8.*1\.3/)
  })

  it('includes rep-ranges per training goal', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/kracht.*1-5 reps/i)
    expect(text).toMatch(/hypertrofie.*6-12|hypertrofie.*8-12/i)
  })

  it('includes protein target range per kg LBM', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/1\.6.*2\.2 ?g\/kg|2\.2 ?g\/kg/i)
  })

  it('mentions interferentie-effect for concurrent training', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/interferentie/i)
  })

  it('mentions deload cadence 3-5 weeks', () => {
    const text = buildKnowledgeBase()
    expect(text).toMatch(/deload.*3-?5 weken|deload.*elke 3-?4|3-?4 weken/i)
  })
})

describe('buildMemoryReadBlock', () => {
  it('returns a memory block with category headings and id-tagged lines', async () => {
    const block = await buildMemoryReadBlock('user-123')
    expect(block).toMatch(/MIJN GEHEUGEN OVER JOU/i)
    expect(block).toMatch(/PREFERENCE/i)
    expect(block).toMatch(/\[id:11111111\]/)
    expect(block).toMatch(/'s ochtends/)
  })

  it('returns an empty marker when no memories exist', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    vi.mocked(createAdminClient).mockReturnValueOnce({
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              gte: () => ({
                order: () => ({
                  limit: async () => ({ data: [] }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as never)
    const block = await buildMemoryReadBlock('user-empty')
    expect(block).toMatch(/nog geen geheugen|geen memories/i)
  })
})
