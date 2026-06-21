'use client'

import { X } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { CoachIdentity } from './CoachIdentity'
import { BlockDesignCallout } from './BlockDesignCallout'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

// In-domain openers — the sport coach never offers nutrition/recovery prompts.
const SPORT_SUGGESTIONS = [
  'Wat train ik vandaag?',
  'Hoe staat mijn squat ervoor?',
  'Analyseer mijn progressie',
  'Hoe is mijn trainingsbelasting?',
]

export interface SportCoachSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * SportCoachSheet — slide-up chat with the Sportcoach, living on the Schema tab.
 * Reuses the shared chat engine (coach-scoped to `sport`) under a teal
 * CoachIdentity header, so it's instantly recognisable as the training coach.
 */
export function SportCoachSheet({ open, onClose }: SportCoachSheetProps) {
  const sport = getCoachConfig('sport')

  return (
    <Sheet open={open} onClose={onClose} detents={['large']} grabber autoFocus={false}>
      <div className="flex h-full flex-col">
        <CoachIdentity
          identity={sport.identity}
          status={
            <span className="flex items-center gap-1.5 text-status-good">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-good"
                style={{ boxShadow: '0 0 8px var(--color-status-good)' }}
              />
              Beschikbaar · kent je training
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
        <div className="border-t-[0.5px] border-bg-border px-4 pt-3">
          <BlockDesignCallout />
        </div>
        <div className="min-h-0 flex-1">
          <ChatInterface
            coachId="sport"
            suggestions={SPORT_SUGGESTIONS}
            emptyState="Stel een trainingsvraag — over je schema, progressie of belasting"
          />
        </div>
      </div>
    </Sheet>
  )
}
