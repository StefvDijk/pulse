'use client'

import useSWR from 'swr'

interface Belief {
  id: string
  hypothesis_text: string
  category: 'training' | 'nutrition' | 'recovery' | 'lifestyle' | 'preference'
  confidence: number
  status: 'active' | 'confirmed'
  evidence_for: Array<{ date: string; observation: string; source: string }>
  evidence_against: Array<{ date: string; observation: string; source: string }>
  last_tested_at: string | null
  created_at: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ beliefs: Belief[] }>)

export default function BeliefsReviewPage() {
  const { data, mutate } = useSWR<{ beliefs: Belief[] }>('/api/coach-beliefs', fetcher)

  async function act(id: string, action: 'confirm' | 'reject') {
    const res = await fetch(`/api/coach-beliefs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) mutate()
  }

  const beliefs = data?.beliefs ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold text-white">Wat de coach denkt over jou</h1>
      <p className="mb-6 text-sm text-white/60">
        Werkende hypotheses op basis van je data. Confirm wat klopt, reject wat fout is — dat verbetert wat ik tegen je zeg.
      </p>

      {beliefs.length === 0 && <p className="text-sm text-white/50">Nog geen hypotheses opgebouwd.</p>}

      <div className="flex flex-col gap-3">
        {beliefs.map((b) => (
          <article key={b.id} className="rounded-[18px] border border-white/5 bg-[#1E2230] p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-white/50">{b.category}</span>
              <span className="text-[11px] text-white/40">
                {b.status === 'confirmed' ? 'Bevestigd' : `confidence ${Number(b.confidence).toFixed(2)}`}
              </span>
            </div>
            <p className="text-sm text-white">{b.hypothesis_text}</p>

            {(b.evidence_for.length > 0 || b.evidence_against.length > 0) && (
              <details className="mt-2 text-xs text-white/60">
                <summary className="cursor-pointer text-white/50">Bewijs ({b.evidence_for.length}/{b.evidence_against.length})</summary>
                <ul className="mt-1 space-y-1">
                  {b.evidence_for.map((e, i) => (
                    <li key={`f-${i}`}>+ {e.observation} <span className="text-white/30">({e.source})</span></li>
                  ))}
                  {b.evidence_against.map((e, i) => (
                    <li key={`a-${i}`} className="text-white/50">− {e.observation} <span className="text-white/30">({e.source})</span></li>
                  ))}
                </ul>
              </details>
            )}

            {b.status === 'active' && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => act(b.id, 'confirm')}
                  className="rounded-full bg-[#00E5C7] px-3 py-1 text-xs font-medium text-[#0a0a0a]"
                >
                  Klopt
                </button>
                <button
                  type="button"
                  onClick={() => act(b.id, 'reject')}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  Klopt niet
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}
