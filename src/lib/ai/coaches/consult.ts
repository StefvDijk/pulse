import { z } from 'zod'
import { createJsonCompletion, MEMORY_MODEL } from '@/lib/ai/client'
import { parseAiJson } from '@/lib/ai/parse-ai-json'
import { getCoachConfig } from './registry'
import type { CoachId } from './types'
import { classifyScope, detectDomains, type CoachScope, type CoachDomain } from './scope'

/**
 * A specialist's structured "take" on a question the manager escalated to it.
 */
export interface CoachTake {
  coachId: CoachId
  take: string
}

/**
 * The plan the manager-hub follows for an incoming question (issue #40/#44):
 * the classified scope plus which specialists to consult.
 */
export interface ConsultationPlan {
  scope: CoachScope
  consult: CoachId[]
}

const DOMAIN_COACH: Record<CoachDomain, CoachId> = {
  training: 'sport',
  nutrition: 'nutrition',
  health: 'health',
}
const ALL_SPECIALISTS: readonly CoachId[] = ['sport', 'nutrition', 'health']

/** A single specialist gets this long before it's dropped (degrades like a failure). */
const CONSULT_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
}

/**
 * Decides how the manager approaches a question. `self`/`single` → the manager
 * answers itself (one mixed answer with the full toolset). `cross` → consult the
 * specialists whose domains the question touches; a contentless cross task
 * (e.g. "plan mijn week") consults the whole bench.
 */
export function planConsultation(message: string): ConsultationPlan {
  const scope = classifyScope(message)
  if (scope !== 'cross') return { scope, consult: [] }
  const consult = [...detectDomains(message)].map((d) => DOMAIN_COACH[d])
  return { scope, consult: consult.length >= 2 ? consult : [...ALL_SPECIALISTS] }
}

const TakeSchema = z.object({ take: z.string().min(1).max(600) })

/**
 * Consult ONE specialist (fase C, issue #44): a real sub-call that returns the
 * specialist's domain take. Graceful — any failure resolves to `null` so one
 * specialist falling over never breaks the manager's answer.
 */
export async function consultCoach(
  coachId: CoachId,
  question: string,
  opts: { userId: string; context?: string },
): Promise<CoachTake | null> {
  try {
    const coach = getCoachConfig(coachId)
    const system =
      `${coach.persona ?? ''}\n\n${coach.domainKnowledge ?? ''}\n\n` +
      `Je bent als specialist geraadpleegd door de manager-coach. Geef vanuit JOUW domein ` +
      `een korte, scherpe take (max 3 zinnen) op de vraag — geen aanhef of afsluiting. ` +
      `Antwoord als JSON: {"take": "..."}.`
    const raw = await createJsonCompletion({
      system,
      userMessage: `Vraag: ${question}${opts.context ? `\n\nContext:\n${opts.context}` : ''}`,
      model: MEMORY_MODEL,
      meta: { userId: opts.userId, feature: `consult_${coachId}` },
    })
    return { coachId, take: TakeSchema.parse(parseAiJson(raw)).take.trim() }
  } catch (err) {
    console.error(`[consultCoach] ${coachId} failed:`, err)
    return null
  }
}

export interface ConsultationResult {
  scope: CoachScope
  consulted: CoachId[]
  takes: CoachTake[]
}

/**
 * The orchestration pass (fase C): for a cross-domain question, consult the
 * relevant specialists IN PARALLEL and collect their takes. Failed specialists
 * drop out; the manager synthesises whatever came back into one mixed answer.
 */
export async function orchestrateConsultation(
  message: string,
  opts: { userId: string; context?: string },
): Promise<ConsultationResult> {
  const plan = planConsultation(message)
  if (plan.scope !== 'cross' || plan.consult.length === 0) {
    return { scope: plan.scope, consulted: [], takes: [] }
  }
  // Race each specialist against a timeout so a SLOW one drops out just like a
  // thrown one — graceful degradation covers latency, not only errors.
  const results = await Promise.all(
    plan.consult.map((c) => withTimeout(consultCoach(c, message, opts), CONSULT_TIMEOUT_MS, null)),
  )
  return {
    scope: plan.scope,
    consulted: plan.consult,
    takes: results.filter((t): t is CoachTake => t !== null),
  }
}

function renderTakeLines(takes: CoachTake[]): string {
  return takes.map((t) => `- ${getCoachConfig(t.coachId).identity.name}: ${t.take}`).join('\n')
}

/**
 * Render specialist takes into a manager-context block for a free-form chat
 * answer — instructs the manager to synthesise them into one mixed answer.
 */
export function renderTakesBlock(takes: CoachTake[]): string {
  if (takes.length === 0) return ''
  return (
    `\n\n## SPECIALISTEN GERAADPLEEGD\n` +
    `De specialisten gaven hun take. Synthetiseer ze tot ÉÉN samenhangend, gemengd antwoord ` +
    `(noem ze niet als aparte stemmen):\n${renderTakeLines(takes)}`
  )
}

/**
 * Render specialist takes as neutral context to weigh — for a structured-output
 * surface (e.g. the check-in) that must not be told to produce one free answer.
 */
export function renderTakesContext(takes: CoachTake[]): string {
  if (takes.length === 0) return ''
  return `\n\n## SPECIALIST-INZICHTEN (meegewogen)\n${renderTakeLines(takes)}`
}
