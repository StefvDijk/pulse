import { Trophy } from 'lucide-react'
import { Card } from '@/components/ui/v2'
import { ExerciseImage } from '@/components/shared/ExerciseImage'
import type { WorkoutExerciseDetail, WorkoutSet } from '@/app/api/workouts/[id]/route'

const MUSCLE_COLOR: Record<string, string> = {
  chest: '#FF5E3A',
  shoulders: '#FFB020',
  arms: '#A78BFA',
  back: '#00E5C7',
  legs: '#9CFF4F',
  core: '#4FC3F7',
}

function muscleColor(group: string | null | undefined): string {
  if (!group) return '#A78BFA'
  return MUSCLE_COLOR[group.toLowerCase()] ?? '#A78BFA'
}

interface SetRowProps {
  set: WorkoutSet
  prevSet?: WorkoutSet
  index: number
}

function SetRow({ set, prevSet, index }: SetRowProps) {
  const isWarmup = set.set_type === 'warmup'
  const isDropset = set.set_type === 'dropset'
  const improved = prevSet?.weight_kg && set.weight_kg && set.weight_kg > prevSet.weight_kg

  return (
    <div
      className={`flex items-center gap-3 py-1.5 ${index > 0 ? 'border-t-[0.5px] border-bg-border' : ''}`}
      style={{ opacity: isWarmup ? 0.5 : 1 }}
    >
      <div className="w-4 text-center text-[11px] font-semibold text-text-tertiary">
        {isWarmup ? 'W' : isDropset ? 'D' : index}
      </div>
      <div className="flex flex-1 items-baseline gap-1.5">
        {set.weight_kg != null && (
          <div className="text-[15px] font-semibold tabular-nums text-text-primary">
            {set.weight_kg}
            <span className="ml-0.5 text-[11px] font-medium text-text-tertiary">kg</span>
          </div>
        )}
        {set.reps != null && (
          <div className="text-[13px] tabular-nums text-text-secondary">× {set.reps}</div>
        )}
        {set.distance_meters != null && set.distance_meters > 0 && (
          <div className="text-[13px] tabular-nums text-text-secondary">
            {(set.distance_meters / 1000).toFixed(2)} km
          </div>
        )}
        {set.duration_seconds != null && set.duration_seconds > 0 && !set.distance_meters && (
          <div className="text-[13px] tabular-nums text-text-secondary">
            {Math.round(set.duration_seconds)}s
          </div>
        )}
      </div>
      {improved && (
        <span className="text-[10px] font-semibold" style={{ color: '#22D67A' }}>
          ↑ +{(set.weight_kg! - prevSet!.weight_kg!).toFixed(1)}kg
        </span>
      )}
      {set.rpe != null && (
        <span className="text-[11px] text-text-tertiary tabular-nums">RPE {set.rpe}</span>
      )}
    </div>
  )
}

interface ExerciseCardProps {
  exercise: WorkoutExerciseDetail
  prevExercise?: { name: string; sets: WorkoutSet[] }
}

export function ExerciseCard({ exercise, prevExercise }: ExerciseCardProps) {
  const c = muscleColor(exercise.primary_muscle_group)
  const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')
  const warmupSets = exercise.sets.filter((s) => s.set_type === 'warmup')

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 p-[14px_16px_10px]">
        <div
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px]"
          style={{ background: `${c}1f`, border: `0.5px solid ${c}40` }}
        >
          <div
            className="h-3.5 w-3.5 rounded-[4px]"
            style={{ background: c, boxShadow: `0 0 8px ${c}` }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[15px] font-semibold tracking-[-0.2px] text-text-primary">
              {exercise.name}
            </div>
            {exercise.is_pr && (
              <span
                className="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(255,176,32,0.16)', color: '#FFB020' }}
              >
                <Trophy size={9} aria-hidden="true" /> PR
              </span>
            )}
          </div>
          <div className="text-[11px] capitalize text-text-tertiary">
            {exercise.primary_muscle_group ?? 'work'} · {workingSets.length}{' '}
            {workingSets.length === 1 ? 'set' : 'sets'}
            {warmupSets.length > 0 && ` + ${warmupSets.length} warmup`}
          </div>
        </div>
        {exercise.image_url && (
          <ExerciseImage
            imageUrl={exercise.image_url}
            muscleGroup={exercise.primary_muscle_group}
            name={exercise.name}
            size="md"
          />
        )}
      </div>
      <div className="p-[0_16px_10px]">
        {exercise.sets.map((set, i) => {
          const workingIndex = exercise.sets
            .filter((s) => s.set_type !== 'warmup')
            .indexOf(set)
          const prevSet = prevExercise?.sets[workingIndex]
          return (
            <SetRow
              key={set.set_order}
              set={set}
              prevSet={prevSet}
              index={i === 0 ? 0 : workingIndex >= 0 ? workingIndex + 1 : i + 1}
            />
          )
        })}
      </div>
      {exercise.notes && (
        <div className="border-t-[0.5px] border-bg-border p-[10px_16px] text-[12px] italic text-text-tertiary">
          {exercise.notes}
        </div>
      )}
    </Card>
  )
}
