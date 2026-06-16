import { describe, expect, it } from 'vitest'
import {
  createStreamTagStripper,
  CHAT_WRITEBACK_TAGS,
} from '@/lib/ai/chat/strip-stream-tags'

// Feed a full text one character at a time (worst case for chunk boundaries)
// and return the concatenated clean output.
function stripCharByChar(text: string): string {
  const s = createStreamTagStripper(CHAT_WRITEBACK_TAGS)
  let out = ''
  for (const ch of text) out += s.feed(ch)
  out += s.flush()
  return out
}

// Feed in arbitrary chunk sizes.
function stripChunks(chunks: string[]): string {
  const s = createStreamTagStripper(CHAT_WRITEBACK_TAGS)
  let out = ''
  for (const c of chunks) out += s.feed(c)
  out += s.flush()
  return out
}

describe('createStreamTagStripper', () => {
  it('passes through plain text unchanged', () => {
    expect(stripCharByChar('Goed bezig vandaag, je bench staat op 92kg.')).toBe(
      'Goed bezig vandaag, je bench staat op 92kg.',
    )
  })

  it('strips a complete write-back tag in one chunk', () => {
    expect(
      stripChunks(['<nutrition_log>{"input":"200g kwark"}</nutrition_log>Genoteerd.']),
    ).toBe('Genoteerd.')
  })

  it('strips a large schema tag split across many chunks', () => {
    const big = `<schema_generation>{"title":"Upper/Lower","weeks_planned":8,"workout_schedule":[${'x'.repeat(500)}]}</schema_generation>`
    const text = `Hier is je nieuwe schema. ${big} Klaar om te starten.`
    // Split into 7-char chunks to cross the tag boundary repeatedly.
    const chunks: string[] = []
    for (let i = 0; i < text.length; i += 7) chunks.push(text.slice(i, i + 7))
    const out = stripChunks(chunks)
    expect(out).toBe('Hier is je nieuwe schema.  Klaar om te starten.')
    expect(out).not.toContain('<schema_generation>')
    expect(out).not.toContain('weeks_planned')
  })

  it('strips a trailing cited_memories tag char-by-char without leaking', () => {
    const text = 'Je knie zeurde vorige maand. <cited_memories>a1b2c3d4,e5f6</cited_memories>'
    const out = stripCharByChar(text)
    expect(out).toBe('Je knie zeurde vorige maand. ')
    expect(out).not.toContain('<cited')
  })

  it('never leaks a partial opening tag mid-stream', () => {
    const s = createStreamTagStripper(CHAT_WRITEBACK_TAGS)
    // Emit the start of an injury tag in pieces; nothing tag-ish should appear.
    const pieces = ['Let op je ', '<inj', 'ury_log>{"body_location":"knie",', '"severity":"mild","description":"zeurt"}', '</injury_log>', ' rustig aan.']
    let live = ''
    for (const p of pieces) live += s.feed(p)
    live += s.flush()
    expect(live).toBe('Let op je  rustig aan.')
    // At no intermediate point did a '<inj' fragment escape.
    expect(live).not.toContain('<inj')
  })

  it('drops a dangling unclosed tag at flush (truncated payload)', () => {
    // A schema tag that never closes (e.g. token truncation) must not leak.
    const out = stripChunks(['Antwoord. <schema_generation>{"title":"half'])
    expect(out).toBe('Antwoord. ')
  })

  it('keeps a literal less-than in normal prose', () => {
    expect(stripCharByChar('Squat is 3 < 5 sets vandaag.')).toBe('Squat is 3 < 5 sets vandaag.')
  })

  it('handles multiple tags in one response', () => {
    const text =
      '<nutrition_log>{"input":"x"}</nutrition_log>Genoteerd. ' +
      '<injury_log>{"body_location":"knie","severity":"mild","description":"y"}</injury_log>' +
      'Sterkte. <cited_memories>aaaa</cited_memories>'
    expect(stripChunks([text])).toBe('Genoteerd. Sterkte. ')
  })
})
