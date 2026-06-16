import type { ReconciledItem } from '@/lib/training/reconcile-week'
import type { ActivityToken } from '@/hooks/useSchemaWeek'

/** Filtert op één displaydag en mapt ReconciledItem naar de bestaande ActivityToken-vorm. */
export function toTokens(items: ReconciledItem[], date: string): ActivityToken[] {
  return items
    .filter((i) => i.displayDate === date && i.state !== 'missed')
    .map((i): ActivityToken => ({
      type: i.kind,
      state: i.state as ActivityToken['state'],
      // Behoud huidige weergave: gym/padel tonen actual-titel; run done-as-planned toont de
      // geplande focus (zoals het oude endpoint deed), anders 'Hardlopen'.
      title:
        i.kind === 'run' && i.state === 'done-as-planned' && i.plannedFocus
          ? i.plannedFocus
          : i.title,
      swappedFrom: i.swappedFrom,
      actualId: i.completionId,
      actualDurationSeconds: i.durationSeconds,
      actualStartedAt: i.startedAt,
      distanceMeters: i.distanceMeters,
      exercises: i.actualExercises as ActivityToken['exercises'],
      subtitle: i.subtitle,
      durationMin: i.durationMin,
    }))
}
