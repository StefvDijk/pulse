import { Card } from '@/components/ui/v2'
import type { WorkloadStatus } from '@/types/workload'

const STATUS_COLOR: Record<WorkloadStatus, string> = {
  low: 'rgba(142,142,147,1)',
  optimal: '#22D67A',
  warning: '#FFB020',
  danger: '#FF4D6D',
}

const ZONES: Array<[WorkloadStatus, string, string]> = [
  ['low', 'Te licht', 'onder 0.6 — meerdere weken zo betekent fitness-verlies.'],
  ['optimal', 'In balans', '0.6 – 1.3 — sweet spot, prikkel met ruimte voor herstel.'],
  ['warning', 'Opbouw', '1.3 – 1.5 — actief progressief, blijf alert.'],
  ['danger', 'Overbelast', 'boven 1.5 — fors verhoogd blessurerisico.'],
]

export function WorkloadExplainerCard() {
  return (
    <Card className="p-[18px]">
      <div className="text-[16px] font-semibold text-text-primary">Wat betekent dit?</div>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
        Je belasting (ACWR) vergelijkt de afgelopen{' '}
        <strong className="text-text-primary">7 dagen</strong> met je gemiddelde over{' '}
        <strong className="text-text-primary">28 dagen</strong>.
      </p>
      <ul className="mt-4 space-y-2.5">
        {ZONES.map(([key, label, body]) => (
          <li key={key} className="flex gap-3">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: STATUS_COLOR[key] }}
            />
            <p className="text-[13px] text-text-secondary">
              <span className="font-semibold text-text-primary">{label}</span> · {body}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-text-tertiary">
        Je dagelijkse trainingsbelasting is een gewogen som van gym-tonnage, hardloop-afstand
        en -tempo, en padel-tijd. Rustdagen tellen als 0.
      </p>
    </Card>
  )
}
