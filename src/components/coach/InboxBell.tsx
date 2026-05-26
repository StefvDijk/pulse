'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { InboxList } from './InboxList'
import type { CoachInboxResponse } from './types'

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<CoachInboxResponse>)

export function InboxBell() {
  const [open, setOpen] = useState(false)
  const { data, mutate } = useSWR<CoachInboxResponse>('/api/coach-inbox', fetcher, { refreshInterval: 60_000 })
  const unread = data?.unreadCount ?? 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#1E2230] border border-white/5 text-white/80 hover:text-white"
        aria-label={`Coach inbox (${unread} ongelezen)`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97757] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <InboxList
          items={data?.items ?? []}
          onClose={() => setOpen(false)}
          onMutate={() => mutate()}
        />
      )}
    </div>
  )
}
