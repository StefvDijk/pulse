import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

type CronRunStatus = 'success' | 'partial' | 'error'

export interface CronRunClassification {
  status: CronRunStatus
  processed: number
  errorCount: number
  truncated: boolean
}

interface CronTaskResult {
  response: NextResponse
  nextCursor: string | null
}

const ClaimSchema = z.object({
  lease_token: z.string().uuid(),
  cursor: z.string().nullable(),
})

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

export function classifyCronRun(
  httpStatus: number,
  body: Record<string, unknown>,
): CronRunClassification {
  const processed = nonNegativeNumber(body.processed ?? body.swept ?? body.candidates)
  const errorCount = nonNegativeNumber(
    body.totalErrors ?? body.failed ?? body.errorCount,
  )
  const truncated = body.truncated === true
  const hasPartialWork = processed > 0 && (errorCount > 0 || truncated)

  return {
    status:
      errorCount > 0 || truncated
        ? hasPartialWork || httpStatus < 400
          ? 'partial'
          : 'error'
        : httpStatus >= 400
          ? 'error'
          : 'success',
    processed,
    errorCount,
    truncated,
  }
}

function firstError(body: Record<string, unknown>): string | null {
  if (typeof body.error === 'string') return body.error.slice(0, 1000)
  if (!Array.isArray(body.results)) return null
  for (const result of body.results) {
    if (!result || typeof result !== 'object') continue
    const value = result as Record<string, unknown>
    if (typeof value.error === 'string') return value.error.slice(0, 1000)
    if (Array.isArray(value.errors) && typeof value.errors[0] === 'string') {
      return value.errors[0].slice(0, 1000)
    }
  }
  return null
}

/** Execute a cron body and persist its terminal status for later diagnosis. */
export async function runCronWithStatus(
  jobName: string,
  task: (context: { cursor: string | null }) => Promise<CronTaskResult>,
): Promise<NextResponse> {
  const admin = createAdminClient()
  const { data: claimRaw, error: claimError } = await admin.rpc('claim_cron_job', {
    p_job_name: jobName,
    p_lease_seconds: 330,
  })
  if (claimError) {
    console.error(`[cron:${jobName}] lease claim failed:`, claimError)
    return NextResponse.json(
      { error: 'Cron already running', code: 'CRON_LEASE_UNAVAILABLE' },
      { status: 409 },
    )
  }
  const claim = ClaimSchema.parse(claimRaw)

  const { data: started, error: startError } = await admin
    .from('cron_runs')
    .insert({ job_name: jobName })
    .select('id')
    .single()

  if (startError || !started) {
    console.error(`[cron:${jobName}] run-status insert failed:`, startError)
    await admin.rpc('finish_cron_job', {
      p_job_name: jobName,
      p_lease_token: claim.lease_token,
      p_next_cursor: claim.cursor,
    })
    return NextResponse.json(
      { error: 'Cron status unavailable', code: 'CRON_STATUS_UNAVAILABLE' },
      { status: 503 },
    )
  }

  try {
    const { response, nextCursor } = await task({ cursor: claim.cursor })
    const parsedBody = (await response.clone().json().catch(() => ({}))) as Record<string, unknown>
    const classification = classifyCronRun(response.status, parsedBody)
    const { status, processed, errorCount, truncated } = classification
    const { error: finishError } = await admin
      .from('cron_runs')
      .update({
        status,
        processed,
        error_count: errorCount,
        truncated,
        http_status: response.status,
        finished_at: new Date().toISOString(),
        summary: parsedBody as Json,
        first_error: firstError(parsedBody),
      })
      .eq('id', started.id)

    const { error: leaseFinishError } = await admin.rpc('finish_cron_job', {
      p_job_name: jobName,
      p_lease_token: claim.lease_token,
      p_next_cursor: nextCursor,
    })
    if (finishError) {
      console.error(`[cron:${jobName}] run-status update failed:`, finishError)
      return NextResponse.json(
        { error: 'Cron status update failed', code: 'CRON_STATUS_UPDATE_FAILED' },
        { status: 503 },
      )
    }
    if (leaseFinishError) {
      console.error(`[cron:${jobName}] cursor update failed:`, leaseFinishError)
      return NextResponse.json(
        { error: 'Cron cursor update failed', code: 'CRON_CURSOR_UPDATE_FAILED' },
        { status: 503 },
      )
    }
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const { error: finishError } = await admin
      .from('cron_runs')
      .update({
        status: 'error',
        http_status: 500,
        error_count: 1,
        finished_at: new Date().toISOString(),
        first_error: message.slice(0, 1000),
      })
      .eq('id', started.id)
    if (finishError) console.error(`[cron:${jobName}] failed to record thrown error:`, finishError)
    const { error: leaseFinishError } = await admin.rpc('finish_cron_job', {
      p_job_name: jobName,
      p_lease_token: claim.lease_token,
      p_next_cursor: claim.cursor,
    })
    if (leaseFinishError) {
      console.error(`[cron:${jobName}] failed to release lease after error:`, leaseFinishError)
    }
    throw error
  }
}
