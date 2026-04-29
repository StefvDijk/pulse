import useSWR from 'swr'

export interface WeeklyLessonEntry {
  id: string
  week_start: string
  lesson_text: string
  category: string
  created_at: string
}

interface WeeklyLessonsResponse {
  lessons: WeeklyLessonEntry[]
}

async function fetcher(url: string): Promise<WeeklyLessonsResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useWeeklyLessons() {
  const { data, error, isLoading } = useSWR<WeeklyLessonsResponse>(
    '/api/weekly-lessons',
    fetcher,
  )

  return {
    lessons: data?.lessons ?? [],
    isLoading,
    error: error as Error | undefined,
  }
}
