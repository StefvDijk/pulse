'use client'

import { SWRConfig } from 'swr'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 60_000,
        focusThrottleInterval: 60_000,
        errorRetryCount: 2,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
