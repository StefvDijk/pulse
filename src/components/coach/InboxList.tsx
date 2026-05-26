'use client'

import { useEffect, useRef } from 'react'
import { InboxCard } from './InboxCard'

interface InboxItem {
  id: string
  message_text: string
  type: string
  priority: 'low' | 'medium' | 'high'
  requires_response: boolean
  status: 'unread' | 'read' | 'dismissed' | 'actioned'
  related_entity_id: string | null
  created_at: string
}

interface Props {
  items: InboxItem[]
  onClose: () => void
  onMutate: () => void
}

const PRIORITY_ORDER: Record<InboxItem['priority'], number> = { high: 0, medium: 1, low: 2 }

export function InboxList({ items, onClose, onMutate }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const sorted = [...items].sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (p !== 0) return p
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div
      ref={ref}
      className="absolute right-0 top-11 z-50 max-h-[70vh] w-[340px] overflow-y-auto rounded-[18px] border border-white/5 bg-[#15171F] p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Coach-inbox</h3>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white" aria-label="Sluit">
          ×
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="px-1 py-4 text-xs text-white/50">Niets om over te lezen — de coach houdt zich gedeisd.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <InboxCard key={item.id} item={item} onChanged={onMutate} />
          ))}
        </div>
      )}
    </div>
  )
}
