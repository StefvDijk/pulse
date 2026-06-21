'use client'

import { X } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { CoachIdentity } from './CoachIdentity'
import { getCoachConfig } from '@/lib/ai/coaches/registry'

// In-domain openers — the diëtist never offers training/recovery prompts.
const NUTRITION_SUGGESTIONS = [
  'Log: 200g kip met rijst',
  'Hoeveel eiwit heb ik vandaag al?',
  'Lig ik op koers voor mijn calorieën?',
  'Wat is mijn eiwit-doel?',
]

export interface NutritionCoachSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * NutritionCoachSheet — slide-up chat with the Diëtist, living on the Eten tab.
 * Reuses the shared chat engine (coach-scoped to `nutrition`) under a green
 * CoachIdentity header, so it's instantly recognisable as the voedingscoach.
 */
export function NutritionCoachSheet({ open, onClose }: NutritionCoachSheetProps) {
  const nutrition = getCoachConfig('nutrition')

  return (
    <Sheet open={open} onClose={onClose} detents={['large']} grabber autoFocus={false}>
      <div className="flex h-full flex-col">
        <CoachIdentity
          identity={nutrition.identity}
          status={
            <span className="flex items-center gap-1.5 text-status-good">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-good"
                style={{ boxShadow: '0 0 8px var(--color-status-good)' }}
              />
              Beschikbaar · kent je voeding
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
            coachId="nutrition"
            suggestions={NUTRITION_SUGGESTIONS}
            emptyState="Log een maaltijd of vraag naar je macro's — in gewoon Nederlands"
          />
        </div>
      </div>
    </Sheet>
  )
}
