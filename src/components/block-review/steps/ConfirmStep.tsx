'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from '../StepShell'
import type { BlockReviewData } from '@/lib/block-review/aggregator'
import type { BlockReviewFormState } from '../types'

interface Props {
  data: BlockReviewData
  form: BlockReviewFormState
  dryRun: boolean
  stepIndex: number
  stepTotal: number
  onBack?: () => void
}

export function ConfirmStep({ data, form, dryRun, stepIndex, stepTotal, onBack }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasBlockers = !!form.aiProgramAudit?.hasBlockers
  const hasSchemaProposal = form.aiSchemaProposal != null

  async function submit() {
    if (!hasSchemaProposal) {
      setError('Er is geen nieuw schema-voorstel om te starten. Ga terug naar stap 5 en genereer een voorstel.')
      return
    }
    if (hasBlockers) {
      setError('De schema-audit bevat nog blockers. Ga terug naar stap 5 en laat de coach het schema herstellen.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/block-review/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: data.schema.id,
          end_reason: form.endReason,
          reflection: form.reflection,
          new_in_body: form.newInBody,
          ai_analysis: form.aiAnalysis,
          ai_schema_proposal: form.aiSchemaProposal,
          new_schema: form.aiSchemaProposal,
          selected_goal_ids: form.selectedGoals.filter((g) => !g.isNew && g.id).map((g) => g.id!),
          dry_run: dryRun,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
          audit?: { items?: Array<{ severity: string; message: string }> }
        }
        const blockers = body.audit?.items?.filter((i) => i.severity === 'blocker').map((i) => i.message)
        throw new Error(blockers?.length ? blockers.join(' ') : body.error ?? 'Opslaan mislukt')
      }
      router.push('/schema')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <StepShell title="Bevestigen" stepIndex={stepIndex} stepTotal={stepTotal} onBack={onBack}>
      {dryRun && (
        <div className="rounded-card-lg bg-status-warning/10 border border-status-warning/40 p-3 text-[13px] text-status-warning">
          🧪 Test mode actief — bij bevestigen wordt niets opgeslagen. Schakel uit met de knop rechtsonder om écht te bevestigen.
        </div>
      )}

      <section className="rounded-card-lg bg-bg-surface border border-bg-border p-4 text-[13px] text-text-secondary">
        <p className="text-text-primary">Klaar om af te sluiten:</p>
        <ul className="mt-2 list-disc list-inside space-y-0.5">
          <li>Block review opslaan ({data.schema.weeksPlanned} weken snapshot)</li>
          <li>Oud schema &ldquo;{data.schema.title}&rdquo; sluiten</li>
          {form.aiSchemaProposal != null && <li>Nieuw schema activeren</li>}
          {form.aiProgramAudit?.hasBlockers && <li>Schema-audit bevat nog blockers</li>}
          {form.newInBody && <li>InBody-meting toevoegen</li>}
          {form.reflection.biggestWin && <li>Win opslaan in coach-geheugen</li>}
          {form.reflection.biggestMiss && <li>Miss opslaan in coach-geheugen</li>}
        </ul>
      </section>

      {error && <div className="text-status-danger text-[13px]">{error}</div>}

      {!hasSchemaProposal && (
        <div className="rounded-card-lg bg-status-warning/10 border border-status-warning/40 p-3 text-[13px] text-status-warning">
          Er is nog geen nieuw schema-voorstel. Ga terug naar stap 5 en genereer het volledige voorstel.
        </div>
      )}

      {hasBlockers && (
        <div className="rounded-card-lg bg-status-danger/10 border border-status-danger/40 p-3 flex flex-col gap-2">
          <div className="text-[13px] text-status-danger">
            De schema-audit bevat nog blockers. Ga terug naar stap 5 en laat de coach het schema herstellen voordat je start.
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || hasBlockers || !hasSchemaProposal}
        className="w-full h-12 rounded-full text-[15px] font-semibold text-black bg-white disabled:opacity-30"
      >
        {submitting ? 'Bezig...' : dryRun ? 'Test bevestiging' : 'Bevestig & start nieuw blok'}
      </button>
    </StepShell>
  )
}
