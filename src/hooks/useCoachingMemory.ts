import useSWR from 'swr'

export interface CoachingMemoryEntry {
  id: string
  category: string
  key: string
  value: string
  source_date: string
  updated_at: string
}

interface CoachingMemoryResponse {
  memories: CoachingMemoryEntry[]
}

async function fetcher(url: string): Promise<CoachingMemoryResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useCoachingMemory() {
  const { data, error, isLoading, mutate } = useSWR<CoachingMemoryResponse>(
    '/api/coaching-memory',
    fetcher,
  )

  async function updateMemory(id: string, value: string) {
    await fetch('/api/coaching-memory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, value }),
    }).then((r) => { if (!r.ok) throw new Error() })
    mutate()
  }

  async function deleteMemory(id: string) {
    await fetch('/api/coaching-memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then((r) => { if (!r.ok) throw new Error() })
    mutate()
  }

  return {
    memories: data?.memories ?? [],
    isLoading,
    error: error as Error | undefined,
    updateMemory,
    deleteMemory,
    refresh: mutate,
  }
}
