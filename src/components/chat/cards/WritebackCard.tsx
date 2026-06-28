'use client'

import type { WritebackCardData } from '@/lib/ai/chat/cards'

export interface WritebackCardProps { data: WritebackCardData }

export function WritebackCard({ data }: WritebackCardProps) {
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-[rgba(0,229,199,0.4)] bg-[rgba(0,229,199,0.1)] px-3 py-1">
      <span className="text-caption1 font-semibold text-[#00E5C7]">{data.label}</span>
    </div>
  )
}
