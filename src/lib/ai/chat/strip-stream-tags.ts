// ---------------------------------------------------------------------------
// Incremental write-back tag stripper for the chat stream (audit #22, defect 3).
//
// The coach emits write-back tags (<nutrition_log>, <schema_generation>, …)
// inline in its response. The route forwards every chunk raw, so the user used
// to watch a wall of `<schema_generation>{...huge json...}` type out before the
// readable answer. This stripper removes those tags from the DISPLAYED stream
// while the route keeps accumulating the raw text separately for the post-stream
// write-back extraction.
//
// It is chunk-boundary safe: a tag can be split across any number of chunks
// (a schema JSON spans dozens), so we hold back the tail of the buffer whenever
// it could be the start of, or the middle of, an unclosed known tag, and only
// release once the tag closes (and is removed) or proves not to be a tag.
// ---------------------------------------------------------------------------

export interface StreamTagStripper {
  /** Feed a raw chunk; returns the clean text safe to emit now (may be ''). */
  feed(chunk: string): string
  /** Call once the stream ends; returns any remaining clean text. */
  flush(): string
}

export function createStreamTagStripper(tagNames: string[]): StreamTagStripper {
  let buffer = ''
  const openMarkers = tagNames.map((t) => `<${t}>`.toLowerCase())
  const closeMarkers = tagNames.map((t) => `</${t}>`.toLowerCase())
  const allMarkers = [...openMarkers, ...closeMarkers]

  function stripComplete(s: string): string {
    let out = s
    for (const t of tagNames) {
      // Tolerate stray whitespace before '>' (e.g. a model emitting
      // '</schema_generation >') so a minor typo doesn't leave the tag
      // unclosed and swallow the prose after it.
      out = out.replace(new RegExp(`<${t}\\s*>[\\s\\S]*?</${t}\\s*>`, 'gi'), '')
    }
    return out
  }

  // Index from which the buffer must be held back: the first '<' that begins
  // either an unclosed known open tag, or a partial marker that could still
  // grow into one. Returns buffer.length when nothing needs holding.
  function findHoldIndex(buf: string): number {
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] !== '<') continue
      const rest = buf.slice(i).toLowerCase()
      // Unclosed open tag: the open marker is fully present but its matching
      // close was not found by stripComplete, so the payload is still arriving.
      if (openMarkers.some((m) => rest.startsWith(m))) return i
      // Partial marker at the tail that could still become a known tag.
      if (allMarkers.some((m) => m.startsWith(rest) && rest.length < m.length)) return i
    }
    return buf.length
  }

  return {
    feed(chunk: string): string {
      buffer = stripComplete(buffer + chunk)
      const hold = findHoldIndex(buffer)
      const emit = buffer.slice(0, hold)
      buffer = buffer.slice(hold)
      return emit
    },
    flush(): string {
      // Strip any final complete tags, then drop a dangling unclosed open tag
      // (from its '<' onward) so a truncated payload never leaks.
      let out = stripComplete(buffer)
      for (const t of tagNames) {
        const m = new RegExp(`<${t}\\s*>`, 'i').exec(out)
        if (m) out = out.slice(0, m.index)
      }
      buffer = ''
      return out
    },
  }
}

/** The write-back + annotation tags the chat coach may emit inline. */
export const CHAT_WRITEBACK_TAGS = [
  'nutrition_log',
  'injury_log',
  'schema_generation',
  'schema_update',
  'cited_memories',
]
