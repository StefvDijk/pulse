import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { priceForModel } from '@/lib/ai/pricing'
import { reportOperationalWarning } from '@/lib/observability/operational-errors'

const ReservationSchema = z.object({
  reservation_id: z.string().uuid(),
  spent_usd: z.number(),
  reserved_usd: z.number(),
  budget_usd: z.number(),
  warning: z.boolean(),
})

export interface AiBudgetReservation {
  id: string
  userId: string
}

export function estimateAiReservationCost(
  model: string,
  maxOutputTokens: number,
  maxModelSteps = 1,
): number {
  const price = priceForModel(model)
  const conservativeInputTokens = 50_000
  const perStep =
    (conservativeInputTokens * price.input + maxOutputTokens * price.output) / 1_000_000
  return perStep * Math.max(1, Math.floor(maxModelSteps))
}

export function readAiBudgetUsd(): number {
  const budget = Number(process.env.AI_MONTHLY_BUDGET_USD)
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('AI_MONTHLY_BUDGET_USD must be a positive number')
  }
  return budget
}

export function isAiBudgetBypassActive(
  value = process.env.AI_BUDGET_BYPASS_UNTIL,
  now = new Date(),
): boolean {
  if (!value) return false
  const expiresAt = new Date(value)
  return Number.isFinite(expiresAt.getTime()) && expiresAt > now
}

export async function reserveAiBudget(
  userId: string | null | undefined,
  model: string,
  maxOutputTokens: number,
  maxModelSteps = 1,
): Promise<AiBudgetReservation | null> {
  if (process.env.NODE_ENV === 'test') return null
  if (!userId) throw new Error('A user id is required for AI budget enforcement')
  if (isAiBudgetBypassActive()) {
    console.warn(`[ai-budget] emergency bypass active for user ${userId}`)
    reportOperationalWarning('ai-budget:emergency-bypass', { userId })
    return null
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('reserve_ai_budget', {
    p_user_id: userId,
    p_budget_usd: readAiBudgetUsd(),
    p_estimated_cost_usd: estimateAiReservationCost(model, maxOutputTokens, maxModelSteps),
  })
  if (error) throw new Error(`AI budget reservation failed: ${error.message}`)
  const reservation = ReservationSchema.parse(data)
  if (reservation.warning) {
    console.warn(
      `[ai-budget] 70% warning for user ${userId}: $${reservation.spent_usd.toFixed(2)} spent, ` +
        `$${reservation.reserved_usd.toFixed(2)} including active reservations of ` +
        `$${reservation.budget_usd.toFixed(2)} budget`,
    )
    reportOperationalWarning('ai-budget:70-percent', {
      userId,
      spentUsd: reservation.spent_usd,
      reservedUsd: reservation.reserved_usd,
      budgetUsd: reservation.budget_usd,
    })
  }
  return { id: reservation.reservation_id, userId }
}

export async function releaseAiBudget(
  reservation: AiBudgetReservation | null | undefined,
): Promise<void> {
  if (!reservation) return
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('release_ai_budget_reservation', {
      p_user_id: reservation.userId,
      p_reservation_id: reservation.id,
    })
    if (error) console.error('[ai-budget] reservation release failed:', error.message)
  } catch (error) {
    console.error('[ai-budget] reservation release threw:', error)
  }
}
