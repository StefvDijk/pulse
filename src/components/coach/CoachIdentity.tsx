'use client'

import type { ReactNode } from 'react'
import { CoachOrb } from '@/components/shared/CoachOrb'
import type { CoachIdentity as CoachIdentityData } from '@/lib/ai/coaches/types'

export interface CoachIdentityProps {
  /** The coach's face: name, accent colour, tagline. */
  identity: CoachIdentityData
  /** Status line under the name. Defaults to the coach's tagline. */
  status?: ReactNode
  /** Optional trailing slot — e.g. a close button when used in a sheet. */
  trailing?: ReactNode
  orbSize?: number
}

/**
 * CoachIdentity — the reusable "who am I talking to" header for any coach
 * chat-surface. Tinted CoachOrb + name + status, driven by a coach's identity
 * so every specialist gets a consistent, recognisable face (sport = teal,
 * manager = coral, …).
 */
export function CoachIdentity({ identity, status, trailing, orbSize = 40 }: CoachIdentityProps) {
  return (
    <div className="flex h-14 items-center gap-3 px-4">
      <CoachOrb size={orbSize} color={identity.color} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[18px] font-bold leading-[22px] tracking-[-0.3px] text-text-primary">
          {identity.name}
        </div>
        {(status ?? identity.tagline) && (
          <div className="truncate text-body-s text-text-secondary">{status ?? identity.tagline}</div>
        )}
      </div>
      {trailing}
    </div>
  )
}
