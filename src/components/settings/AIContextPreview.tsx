'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { SectionHeader } from './shared'

interface PreviewData {
  systemPrompt: string
  customInstructions: string | null
  thinContext: string
  totalChars: number
}

async function fetcher(url: string): Promise<PreviewData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load preview')
  return res.json()
}

export function AIContextPreview() {
  const [open, setOpen] = useState(false)
  const { data, isLoading, mutate } = useSWR<PreviewData>(
    open ? '/api/ai-context-preview' : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  return (
    <div className="bg-bg-surface border border-bg-border rounded-[14px] p-[14px_16px]">
      <SectionHeader title="Context Preview" />
      <p className="mb-3 text-xs text-text-tertiary">
        Dit is wat de AI coach over je weet. Klik om uit te klappen.
      </p>

      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.06] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Volledige AI context
        </span>
        {data && (
          <span className="text-xs text-text-tertiary">
            ~{Math.round(data.totalChars / 1000)}k tekens
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3">
          <div className="mb-2 flex justify-end">
            <button
              onClick={() => mutate()}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              Vernieuw
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-white/[0.06]" />
              ))}
            </div>
          ) : data ? (
            <pre className="max-h-96 overflow-y-auto rounded-lg bg-white/[0.06] p-3 text-xs text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">
              {data.systemPrompt}
              {'\n\n--- DATA CONTEXT ---\n\n'}
              {data.thinContext}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  )
}
