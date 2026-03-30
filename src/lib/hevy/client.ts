import {
  HevyWorkout,
  HevyWorkoutsResponse,
  HevyWorkoutsResponseSchema,
  HevyExerciseTemplate,
  HevyExerciseTemplatesResponseSchema,
} from '@/lib/hevy/types'

const BASE_URL = 'https://api.hevyapp.com'
const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function hevyFetch<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)

  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  }

  const response = await fetch(url.toString(), {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (response.status === 401) {
    throw new Error('Hevy API: Unauthorized — check your API key')
  }

  if (response.status === 429) {
    throw new Error('Hevy API: Rate limit exceeded — try again later')
  }

  if (response.status >= 500) {
    throw new Error(`Hevy API: Server error (${response.status}) — try again later`)
  }

  if (!response.ok) {
    throw new Error(`Hevy API: Unexpected error (${response.status})`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export async function getWorkouts(
  apiKey: string,
  since?: Date,
  page = 1,
): Promise<HevyWorkoutsResponse> {
  const params: Record<string, string> = {
    page: String(page),
    pageSize: String(PAGE_SIZE),
  }

  if (since) {
    params.since = since.toISOString()
  }

  const raw = await hevyFetch<unknown>(apiKey, '/v1/workouts', params)
  return HevyWorkoutsResponseSchema.parse(raw)
}

export async function getWorkout(apiKey: string, id: string): Promise<HevyWorkout> {
  const raw = await hevyFetch<unknown>(apiKey, `/v1/workouts/${id}`)

  // Single workout endpoint may return the workout directly or wrapped
  // Try wrapped shape first, fall back to direct
  const asResponse = HevyWorkoutsResponseSchema.safeParse(raw)
  if (asResponse.success && asResponse.data.workouts.length > 0) {
    return asResponse.data.workouts[0]
  }

  const { HevyWorkoutSchema } = await import('@/lib/hevy/types')
  return HevyWorkoutSchema.parse(raw)
}

export async function getExerciseTemplates(apiKey: string): Promise<HevyExerciseTemplate[]> {
  const allTemplates: HevyExerciseTemplate[] = []
  let page = 1
  let pageCount = 1

  while (page <= pageCount) {
    const raw = await hevyFetch<unknown>(apiKey, '/v1/exercise_templates', {
      page: String(page),
      pageSize: '100',
    })

    const parsed = HevyExerciseTemplatesResponseSchema.parse(raw)
    pageCount = parsed.page_count
    allTemplates.push(...parsed.exercise_templates)
    page++
  }

  return allTemplates
}
