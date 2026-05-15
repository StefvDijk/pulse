'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Check, Smile } from 'lucide-react'
import { QuickCheckInSheet, type QuickCheckinValue } from './QuickCheckInSheet'

interface CheckinResponse {
  date: string
  checkin: {
    id: string
    date: string
    feeling: number
    sleep_quality: number
    note: string | null
    updated_at: string
  } | null
}

async function fetcher(url: string): Promise<CheckinResponse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

export function QuickCheckInBadge() {
  const [open, setOpen] = useState(false)
  const { data, mutate } = useSWR<CheckinResponse>('/api/check-in/quick', fetcher, {
    revalidateOnFocus: false,
  })

  const checkin = data?.checkin ?? null
  const existing: QuickCheckinValue | null = checkin
    ? {
        feeling: checkin.feeling,
        sleep_quality: checkin.sleep_quality,
        note: checkin.note,
      }
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          checkin ? 'Quick check-in bijwerken' : 'Snelle check-in vandaag'
        }
        className="flex w-full items-center gap-3 rounded-2xl border-[0.5px] border-white/[0.10] bg-white/[0.04] p-4 transition-all active:scale-[0.99] active:bg-white/[0.06]"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            checkin ? 'bg-status-good/15' : 'bg-[#0A84FF]/15'
          }`}
        >
          {checkin ? (
            <Check size={20} strokeWidth={2} className="text-status-good" />
          ) : (
            <Smile size={20} strokeWidth={1.7} className="text-[#0A84FF]" />
          )}
        </div>
        <div className="flex-1 text-left">
          {checkin ? (
            <>
              <p className="text-[15px] font-semibold text-text-primary">
                Ingecheckt vandaag
              </p>
              <p className="text-[12px] text-text-secondary">
                Voelen {checkin.feeling}/5 · Slaap {checkin.sleep_quality}/5 · tap om bij te werken
              </p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-text-primary">
                Snelle check-in
              </p>
              <p className="text-[12px] text-text-secondary">
                30 seconden — hoe voel je je en hoe sliep je?
              </p>
            </>
          )}
        </div>
        <span
          className="text-[18px] leading-none text-text-tertiary"
          aria-hidden="true"
        >
          ›
        </span>
      </button>

      <QuickCheckInSheet
        open={open}
        onClose={() => setOpen(false)}
        existing={existing}
        onSaved={() => {
          mutate()
        }}
      />
    </>
  )
}
