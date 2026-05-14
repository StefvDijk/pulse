'use client'

import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface CheckInSuccessProps {
  weekNumber: number
  dryRun: boolean
}

/**
 * CheckInSuccess v2 — confirmation screen after a check-in is saved.
 * Uses the Button primitive for the CTA and Link for the history shortcut.
 */
export function CheckInSuccess({ weekNumber, dryRun }: CheckInSuccessProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-[80px] pb-16">
      {/* Success orb */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: 'rgba(34,214,122,0.15)',
          boxShadow: '0 0 32px rgba(34,214,122,0.3)',
        }}
      >
        <CheckCircle2 size={32} style={{ color: '#22D67A' }} />
      </div>

      <h1 className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">
        {dryRun ? `Week ${weekNumber} (test)` : `Week ${weekNumber} afgesloten!`}
      </h1>

      <p className="text-center text-[14px] text-text-secondary">
        {dryRun
          ? '🧪 Test mode — er is niets opgeslagen.'
          : 'Je check-in is opgeslagen. Goed bezig!'}
      </p>

      {/* Primary CTA — indigo→purple gradient per design ref */}
      <Link
        href="/"
        className="mt-4 inline-flex min-h-[50px] items-center justify-center rounded-[16px] px-6 text-[16px] font-semibold text-white"
        style={{
          background: 'linear-gradient(135deg, #0A84FF, #7C3AED)',
          boxShadow: '0 4px 16px rgba(10,132,255,0.4)',
        }}
      >
        Naar home
      </Link>

      <Link
        href="/check-in/history"
        className="mt-1 text-[13px] font-medium text-[#0A84FF] active:opacity-60"
      >
        Bekijk je check-in historie
      </Link>
    </div>
  )
}
