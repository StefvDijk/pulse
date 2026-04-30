'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Trophy } from 'lucide-react'
import { useWorkoutDetail } from '@/hooks/useWorkoutDetail'
import { ExerciseImage } from '@/components/shared/ExerciseImage'
import { Card } from '@/components/ui/v2'
import { SkeletonCard, SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton'
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

function formatDuration(s: number): string {
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}u ${m % 60}m`
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function SetRow({
  set,
  prevSet,
  index,
}: {
  set: WorkoutSet
  prevSet?: WorkoutSet
  index: number
}) {
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

function ExerciseCard({
  exercise,
  prevExercise,
}: {
  exercise: WorkoutExerciseDetail
  prevExercise?: { name: string; sets: WorkoutSet[] }
}) {
  const c = muscleColor(exercise.primary_muscle_group)
  const workingSets = exercise.sets.filter((s) => s.set_type !== 'warmup')
  const warmupSets = exercise.sets.filter((s) => s.set_type === 'warmup')

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 p-[14px_16px_10px]">
        <div
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px]"
          style={{
            background: `${c}1f`,
            border: `0.5px solid ${c}40`,
          }}
        >
          <div
            className="h-3.5 w-3.5 rounded-[4px]"
            style={{ background: c, boxShadow: `0 0 8px ${c}` }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[15px] font-semibold tracking-[-0.2px] text-text-primary">
              {exercise.name}
            </div>
            {exercise.is_pr && (
              <span
                className="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(255,176,32,0.16)', color: '#FFB020' }}
              >
                <Trophy size={9} /> PR
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

interface WorkoutDetailPageProps {
  workoutId: string
}

export function WorkoutDetailPage({ workoutId }: WorkoutDetailPageProps) {
  const router = useRouter()
  const { workout, isLoading, error } = useWorkoutDetail(workoutId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-24 pt-[60px]">
        <SkeletonLine width="w-1/3" height="h-5" />
        <SkeletonCard className="flex flex-col gap-2">
          <SkeletonLine width="w-1/2" />
          <div className="flex gap-3">
            <SkeletonLine width="w-12" height="h-3" />
            <SkeletonLine width="w-16" height="h-3" />
          </div>
        </SkeletonCard>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="flex flex-col gap-3">
            <SkeletonRect height="h-24" />
          </SkeletonCard>
        ))}
      </div>
    )
  }

  if (error || !workout) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-24 pt-[60px]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[#0A84FF] active:opacity-60"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
          <span className="text-[17px]">Terug</span>
        </button>
        <p className="text-[14px] text-text-tertiary">Workout niet gevonden.</p>
      </div>
    )
  }

  const prevExerciseMap = new Map(
    (workout.previous?.exercises ?? []).map((e) => [e.name.toLowerCase(), e]),
  )

  const visibleExercises = workout.exercises.filter(
    (e) => !e.name.toLowerCase().includes('warm up'),
  )

  const totalSets = visibleExercises.reduce((acc, e) => acc + e.sets.length, 0)

  return (
    <div className="flex flex-col gap-3 pb-24">
      {/* Hero with gradient */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 100% at 100% 0%, rgba(0,229,199,0.30), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(124,58,237,0.18), transparent 60%)',
          }}
        />
        <div className="relative px-4 pb-5 pt-[60px]">
          <button
            onClick={() => router.back()}
            className="-ml-1 mb-2 flex items-center gap-0.5 text-[#0A84FF] active:opacity-60"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
            <span className="text-[17px] tracking-[-0.2px]">Terug</span>
          </button>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.4px]"
            style={{ color: '#00E5C7' }}
          >
            {formatDateLong(workout.started_at)} · {formatTime(workout.started_at)}
          </div>
          <h1 className="mt-1.5 text-[30px] font-bold tracking-[-0.7px] text-text-primary">
            {workout.title}
          </h1>
          {(workout.pr_count ?? 0) > 0 && (
            <div
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                background: 'linear-gradient(135deg, #FFB020, #FF5E3A)',
                boxShadow: '0 4px 12px rgba(255,176,32,0.4)',
              }}
            >
              <Trophy size={13} color="#1a1a1a" />
              <span className="text-[12px] font-bold" style={{ color: '#1a1a1a' }}>
                {workout.pr_count} nieuwe PR{workout.pr_count === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid bar */}
      <div className="px-4">
        <Card className="grid grid-cols-4 p-[14px_8px]">
          {[
            workout.duration_seconds != null && {
              v: formatDuration(workout.duration_seconds).replace(' min', ''),
              u: workout.duration_seconds < 3600 ? 'min' : '',
              l: 'Duur',
            },
            { v: totalSets, u: 'sets', l: 'Volume' },
            workout.total_volume_kg != null && {
              v: (workout.total_volume_kg / 1000).toFixed(1),
              u: 'k',
              l: 'Tonnage',
            },
            workout.avg_heart_rate != null && {
              v: workout.avg_heart_rate,
              u: 'bpm',
              l: 'Avg HR',
            },
            workout.calories_burned != null && {
              v: workout.calories_burned,
              u: 'kcal',
              l: 'Kcal',
            },
          ]
            .filter(Boolean)
            .slice(0, 4)
            .map((stat, i) => {
              if (!stat) return null
              const s = stat as { v: string | number; u: string; l: string }
              return (
                <div
                  key={i}
                  className={`text-center px-1.5 ${i > 0 ? 'border-l-[0.5px] border-bg-border' : ''}`}
                >
                  <div className="text-[18px] font-bold tracking-[-0.4px] tabular-nums">
                    {s.v}
                    <span className="ml-0.5 text-[10px] font-medium text-text-tertiary">{s.u}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-text-tertiary">{s.l}</div>
                </div>
              )
            })}
        </Card>
      </div>

      {/* Exercises */}
      <div className="flex flex-col gap-2.5 px-4">
        {visibleExercises.map((exercise) => (
          <ExerciseCard
            key={exercise.exercise_order}
            exercise={exercise}
            prevExercise={prevExerciseMap.get(exercise.name.toLowerCase())}
          />
        ))}
      </div>

      {workout.notes && (
        <div className="px-4">
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-text-tertiary">
              Notities
            </div>
            <div className="mt-1.5 text-[13px] leading-snug text-text-secondary">{workout.notes}</div>
          </Card>
        </div>
      )}
    </div>
  )
}
