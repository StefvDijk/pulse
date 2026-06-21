import type { CoachId } from './types'

/**
 * Een gestructureerde "take" van een specialist op een vraag van de manager.
 * Wordt pas in fase C (echte orkestratie) gevuld.
 */
export interface CoachTake {
  coachId: CoachId
  take: string
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
