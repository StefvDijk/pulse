'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Bell } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { InboxList } from './InboxList'
import type { CoachInboxResponse } from './types'

async function fetcher(url: string): Promise<CoachInboxResponse> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Coach inbox kon niet laden')
  return response.json() as Promise<CoachInboxResponse>
}

export function InboxBell() {
  const [open, setOpen] = useState(false)
  const { data, error, isLoading, mutate } = useSWR<CoachInboxResponse>('/api/coach-inbox', fetcher, {
    refreshInterval: 60_000,
  })
  useBodyScrollLock(open)
  const unread = data?.unreadCount ?? 0

  return (
    <div className="relative z-[55]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/5 bg-[#1E2230] text-white/80 transition-colors hover:text-white active:bg-white/10"
        aria-label={`Coach inbox (${unread} ongelezen)`}
      >
        <Bell size={20} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97757] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <InboxList
          items={data?.items ?? []}
          isLoading={isLoading}
          isError={Boolean(error)}
          onClose={() => setOpen(false)}
          onMutate={() => mutate()}
        />
      )}
    </div>
  )
}
