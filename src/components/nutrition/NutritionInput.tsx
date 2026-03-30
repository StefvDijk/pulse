'use client'

import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface AnalysisResult {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  meal_type: string
  confidence: 'low' | 'medium' | 'high'
}

export interface NutritionInputProps {
  onSuccess: (result: AnalysisResult) => void
  date: string
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'Zeker', color: '#22c55e' },
  medium: { label: 'Redelijk', color: '#f59e0b' },
  low: { label: 'Schatting', color: '#8888a0' },
}

export function NutritionInput({ onSuccess, date }: NutritionInputProps) {
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    setError(null)
    setLastResult(null)

    try {
      const res = await fetch('/api/nutrition/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed, date }),
      })

      const body = await res.json()

      if (!res.ok) {
        throw new Error(body.error ?? 'Analyse mislukt')
      }

      const result = body.data as AnalysisResult
      setLastResult(result)
      onSuccess(result)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const confidence = lastResult ? CONFIDENCE_LABELS[lastResult.confidence] : null

  return (
    <div className="flex flex-col gap-2">
      {/* Input */}
      <div
        className="flex items-end gap-2 rounded-xl p-3"
        style={{ backgroundColor: '#12121a', border: '1px solid #1a1a2e' }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Wat heb je gegeten?"
          rows={2}
          disabled={isLoading}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:opacity-40"
          style={{ color: '#f0f0f5' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity disabled:opacity-30"
          style={{ backgroundColor: '#4f8cff' }}
          aria-label="Analyseer"
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send size={14} color="white" />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs" style={{ color: '#f87171' }}>
          {error}
        </p>
      )}

      {/* Last result preview */}
      {lastResult && (
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: '#1a1a2e' }}
        >
          <span style={{ color: '#f0f0f5' }}>
            {lastResult.calories} kcal · {lastResult.protein_g}g eiwit · {lastResult.carbs_g}g koolh · {lastResult.fat_g}g vet
          </span>
          {confidence && (
            <span className="ml-2 rounded px-1.5 py-0.5" style={{ color: confidence.color, backgroundColor: `${confidence.color}22` }}>
              {confidence.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
