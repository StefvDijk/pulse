import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import {
  reportOperationalError,
  reportOperationalWarning,
} from '@/lib/observability/operational-errors'
import type { CronItemOutcome } from '@/lib/runtime/cron-items'

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
  itemOutcomes?: CronItemOutcome[]
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
    reportOperationalError(`cron:${jobName}:lease-claim`, claimError)
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
    reportOperationalError(`cron:${jobName}:status-start`, startError ?? new Error('Missing run'))
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
    const { response, nextCursor, itemOutcomes = [] } = await task({ cursor: claim.cursor })
    const parsedBody = (await response.clone().json().catch(() => ({}))) as Record<string, unknown>
    const classification = classifyCronRun(response.status, parsedBody)
    const { status, processed, errorCount, truncated } = classification
    if (status !== 'success') {
      reportOperationalWarning(`cron:${jobName}:${status}`, {
        httpStatus: response.status,
        processed,
        errorCount,
        truncated,
        firstError: firstError(parsedBody),
      })
    }
    const { error: finalizeError } = await admin.rpc('finalize_cron_run', {
      p_run_id: started.id,
      p_job_name: jobName,
      p_lease_token: claim.lease_token,
      p_next_cursor: nextCursor,
      p_status: status,
      p_http_status: response.status,
      p_processed: processed,
      p_error_count: errorCount,
      p_truncated: truncated,
      p_summary: parsedBody as Json,
      p_first_error: firstError(parsedBody),
      p_item_outcomes: itemOutcomes as unknown as Json,
    })
    if (finalizeError) {
      console.error(`[cron:${jobName}] atomic finalization failed:`, finalizeError)
      reportOperationalError(`cron:${jobName}:finalize`, finalizeError)
      return NextResponse.json(
        { error: 'Cron finalization failed', code: 'CRON_FINALIZATION_FAILED' },
        { status: 503 },
      )
    }
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const { error: finalizeError } = await admin.rpc('finalize_cron_run', {
      p_run_id: started.id,
      p_job_name: jobName,
      p_lease_token: claim.lease_token,
      p_next_cursor: claim.cursor,
      p_status: 'error',
      p_http_status: 500,
      p_processed: 0,
      p_error_count: 1,
      p_truncated: false,
      p_summary: { error: message } as Json,
      p_first_error: message.slice(0, 1000),
      p_item_outcomes: [] as Json,
    })
    if (finalizeError) {
      console.error(`[cron:${jobName}] failed to atomically record error:`, finalizeError)
      reportOperationalError(`cron:${jobName}:error-finalize`, finalizeError)
    }
    reportOperationalError(`cron:${jobName}:task`, error)
    throw error
  }
}
