'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { ClipboardCheck } from 'lucide-react'
import type { CheckInStatusData } from '@/app/api/check-in/status/route'

async function fetcher(url: string): Promise<CheckInStatusData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Laden mislukt')
  return res.json()
}

function isCheckInDay(): boolean {
  const day = new Date().getDay()
  // Saturday (6), Sunday (0), Monday (1)
  return day === 6 || day === 0 || day === 1
}

export function CheckInBadge() {
  const shouldShow = isCheckInDay()

  const { data, isLoading } = useSWR<CheckInStatusData>(
    shouldShow ? '/api/check-in/status' : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  // Don't render outside check-in days, while loading, or if review already exists
  if (!shouldShow || isLoading || !data || data.hasReview) {
    return null
  }

  return (
    <Link href="/check-in" className="block">
      <div className="rounded-2xl bg-sport-gym-light border border-sport-gym/20 p-4 flex items-center gap-3 transition-colors hover:bg-sport-gym/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sport-gym/10">
          <ClipboardCheck size={20} className="text-sport-gym" />
        </div>
        <div>
          <p className="text-card-title">Week {data.weekNumber} afsluiten</p>
          <p className="text-caption text-text-tertiary">
            Bekijk je voortgang en sluit af met de coach
          </p>
        </div>
      </div>
    </Link>
  )
}
