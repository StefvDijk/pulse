'use client'

import { X } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { CoachIdentity } from './CoachIdentity'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

// In-domain openers — the gezondheidscoach never offers training/nutrition prompts.
const HEALTH_SUGGESTIONS = [
  'Hoe is mijn herstel vandaag?',
  'Moet ik vandaag trainen of rusten?',
  'Hoe staat mijn HRV ervoor?',
  'Hoe heb ik geslapen deze week?',
]

export interface HealthCoachSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * HealthCoachSheet — slide-up chat with the Gezondheidscoach, living on the
 * Gezondheid tab. Reuses the shared chat engine (coach-scoped to `health`) under
 * an indigo CoachIdentity header, so it's instantly recognisable as the herstelcoach.
 */
export function HealthCoachSheet({ open, onClose }: HealthCoachSheetProps) {
  const health = getCoachConfig('health')

  return (
    <Sheet open={open} onClose={onClose} detents={['large']} grabber autoFocus={false}>
      <div className="flex h-full flex-col">
        <CoachIdentity
          identity={health.identity}
          status={
            <span className="flex items-center gap-1.5 text-status-good">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-good"
                style={{ boxShadow: '0 0 8px var(--color-status-good)' }}
              />
              Beschikbaar · kent je herstel
            </span>
          }
          trailing={
            <button
              type="button"
              aria-label="Sluiten"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-all duration-150 hover:text-text-primary active:scale-95"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          }
        />
        <div className="min-h-0 flex-1 border-t-[0.5px] border-bg-border">
          <ChatInterface
            coachId="health"
            suggestions={HEALTH_SUGGESTIONS}
            emptyState="Vraag over je herstel — slaap, HRV, rusthart of readiness"
          />
        </div>
      </div>
    </Sheet>
  )
}
