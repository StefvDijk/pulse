import type { CoachId } from './types'
import { classifyScope, type CoachScope } from './scope'

/**
 * Een gestructureerde "take" van een specialist op een vraag van de manager.
 * Wordt pas in fase C (echte orkestratie) gevuld.
 */
export interface CoachTake {
  coachId: CoachId
  take: string
}

/**
 * Het plan dat de manager-hub volgt voor een binnenkomende vraag (issue #40):
 * de geclassificeerde scope plus welke specialisten geraadpleegd worden.
 */
export interface ConsultationPlan {
  scope: CoachScope
  consult: CoachId[]
}

/**
 * Bepaalt hoe de manager een vraag aanpakt. Fase A: classificeer de scope maar
 * raadpleeg niemand — de manager antwoordt zelf met de volledige toolset (één
 * gemengd antwoord). Fase C (#44) vult `consult` voor scope `cross` zodat dit
 * een schakelaar wordt, geen herbouw.
 */
export function planConsultation(message: string): ConsultationPlan {
  return { scope: classifyScope(message), consult: [] }
}

/**
 * De consultatie-naad. In fase A (issue #35) is dit bewust een no-op: de manager
 * redeneert zelf met alle tools en raadpleegt geen specialisten. In een latere
 * slice (fase C) laat deze functie de manager echte parallelle sub-agent-calls
 * doen en een `CoachTake` teruggeven. De naad zit er nu al in zodat fase C een
 * schakelaar wordt, geen herbouw.
 */
export async function consultCoach(
  coachId: CoachId,
  question: string,
  context?: string,
): Promise<CoachTake | null> {
  // Fase A: dormant. De argumenten horen bij het fase-C-contract maar worden
  // pas gebruikt zodra echte orkestratie landt.
  void coachId
  void question
  void context
  return null
}
