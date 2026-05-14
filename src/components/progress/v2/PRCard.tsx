/**
 * PRCard — v2 PR list card shell for Progress page.
 * Matches the "Records deze maand" card in Progress (screens/Other.jsx).
 * Composes the existing PRList inside a v2 card shell.
 */
import { PRList, type PRListProps } from '@/components/progress/PRList'

export interface PRCardProps extends PRListProps {
  prCount?: number
}

export function PRCard({ records, prCount }: PRCardProps) {
  return (
    <div className="rounded-[22px] bg-bg-surface border-[0.5px] border-bg-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[17px] font-semibold text-text-primary">Persoonlijke records</div>
        {prCount !== undefined && (
          <span className="text-[11px] text-text-tertiary">{prCount} PRs</span>
        )}
      </div>
      <PRList records={records} />
    </div>
  )
}
