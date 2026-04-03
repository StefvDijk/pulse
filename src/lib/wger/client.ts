import { z } from 'zod'

const BASE_URL = 'https://wger.de/api/v2'

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const WgerSearchSuggestionSchema = z.object({
  data: z.object({
    id: z.number(),
    base_id: z.number(),
    name: z.string(),
    category: z.string(),
    image: z.string().nullable(),
    image_thumbnail: z.string().nullable(),
  }),
})

const WgerSearchResponseSchema = z.object({
  suggestions: z.array(WgerSearchSuggestionSchema),
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search wger for an exercise by name and return the main image URL if found.
 * Returns null if no match or no image available.
 */
export async function searchExerciseImage(
  exerciseName: string,
): Promise<string | null> {
  const url = new URL(`${BASE_URL}/exercise/search/`)
  url.searchParams.set('term', exerciseName)
  url.searchParams.set('format', 'json')
  url.searchParams.set('language', 'english')

  try {
    const response = await fetch(url.toString(), { cache: 'no-store' })

    if (!response.ok) return null

    const raw = await response.json()
    const parsed = WgerSearchResponseSchema.safeParse(raw)

    if (!parsed.success || parsed.data.suggestions.length === 0) return null

    // Find the best match: prefer exact name match, otherwise take first with image
    const normalizedName = exerciseName.toLowerCase().trim()

    const exactMatch = parsed.data.suggestions.find(
      (s) => s.data.name.toLowerCase().trim() === normalizedName && s.data.image,
    )

    if (exactMatch?.data.image) {
      return toAbsoluteUrl(exactMatch.data.image)
    }

    // Fall back to first suggestion that has an image
    const withImage = parsed.data.suggestions.find((s) => s.data.image)

    if (withImage?.data.image) {
      return toAbsoluteUrl(withImage.data.image)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Batch-search images for multiple exercise names.
 * Returns a map of exerciseName → imageUrl (only entries with images).
 */
export async function searchExerciseImages(
  exerciseNames: string[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  // Process sequentially to avoid hammering the wger API
  for (const name of exerciseNames) {
    const imageUrl = await searchExerciseImage(name)
    if (imageUrl) {
      results.set(name, imageUrl)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAbsoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `https://wger.de${path}`
}
