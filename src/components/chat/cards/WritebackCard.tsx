'use client'

import { useState } from 'react'
import type { WritebackCardData } from '@/lib/ai/chat/cards'

export interface WritebackCardProps {
  data: WritebackCardData
}

export function WritebackCard({ data }: WritebackCardProps) {
  const [status, setStatus] = useState<'saved' | 'undoing' | 'undone' | 'error'>(
    data.status ?? 'saved',
  )
  const canUndoNutrition = data.kind === 'nutrition' && Boolean(data.record_id)

  async function undoNutrition() {
    if (!data.record_id || (status !== 'saved' && status !== 'error')) return
    setStatus('undoing')
    try {
      const response = await fetch(`/api/nutrition/log/${data.record_id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`Undo failed with ${response.status}`)
      setStatus('undone')
    } catch (error) {
      console.error('[WritebackCard] Nutrition undo failed:', error)
      setStatus('error')
    }
  }

  if (status === 'undone') {
    return <div className="text-caption1 text-text-tertiary mt-2">Voedingslog ongedaan gemaakt</div>
  }

  return (
    <div className="mt-2 rounded-[14px] border-[0.5px] border-[rgba(0,229,199,0.4)] bg-[rgba(0,229,199,0.1)] px-3 py-2">
      <div className="text-caption1 font-semibold text-[#00E5C7]">{data.label}</div>
      {data.kind === 'nutrition' && data.nutrition && (
        <div className="text-caption1 text-text-secondary mt-1 tabular-nums">
          {Math.round(data.nutrition.calories)} kcal · {data.nutrition.protein_g}g eiwit ·{' '}
          {data.nutrition.carbs_g}g koolhydraten · {data.nutrition.fat_g}g vet
        </div>
      )}
      {canUndoNutrition && (
        <button
          type="button"
          onClick={undoNutrition}
          disabled={status === 'undoing'}
          className="text-caption1 text-text-secondary mt-1 min-h-11 font-medium underline underline-offset-2 disabled:opacity-50"
        >
          {status === 'undoing'
            ? 'Ongedaan maken…'
            : status === 'error'
              ? 'Opnieuw proberen'
              : 'Ongedaan maken'}
        </button>
      )}
      {status === 'error' && (
        <div role="alert" className="text-caption1 text-status-bad">
          Ongedaan maken mislukt
        </div>
      )}
    </div>
  )
}
