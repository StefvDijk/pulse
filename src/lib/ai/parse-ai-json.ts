/**
 * Parse a JSON object out of an LLM response.
 *
 * Models (Haiku especially) sometimes wrap their JSON in ```json fences or add
 * stray prose even when told not to, which makes a bare JSON.parse throw — the
 * nutrition logger hit exactly this and surfaced a generic "Internal server
 * error". Strip a fenced block first, and as a fallback extract the outermost
 * `{...}` before parsing.
 */
export function parseAiJson<T = unknown>(text: string): T {
  const trimmed = text.trim()

  // 1. Strip a single ``` or ```json fenced block if the whole response is one.
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/.exec(trimmed)
  const unfenced = (fenced ? fenced[1] : trimmed).trim()

  try {
    return JSON.parse(unfenced) as T
  } catch {
    // 2. Fallback: take the outermost balanced object. Handles a stray prefix
    //    or suffix around the JSON ("Here you go: {...}").
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(unfenced.slice(start, end + 1)) as T
    }
    throw new Error('AI response did not contain valid JSON')
  }
}
