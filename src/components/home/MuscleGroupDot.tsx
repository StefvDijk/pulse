'use client'

// Maps primary_muscle_group values to a readable label + Tailwind bg color
const MUSCLE_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  chest:       { label: 'Borst',      bg: 'bg-red-500/20',     text: 'text-red-400' },
  shoulders:   { label: 'Schouders',  bg: 'bg-orange-500/20',  text: 'text-orange-400' },
  triceps:     { label: 'Triceps',    bg: 'bg-amber-500/20',   text: 'text-amber-400' },
  upper_back:  { label: 'Rug',        bg: 'bg-blue-500/20',    text: 'text-blue-400' },
  lats:        { label: 'Lats',       bg: 'bg-blue-600/20',    text: 'text-blue-500' },
  biceps:      { label: 'Biceps',     bg: 'bg-cyan-500/20',    text: 'text-cyan-400' },
  forearms:    { label: 'Onderarm',   bg: 'bg-cyan-400/20',    text: 'text-cyan-300' },
  quads:       { label: 'Quads',      bg: 'bg-green-500/20',   text: 'text-green-400' },
  hamstrings:  { label: 'Hamstring',  bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  glutes:      { label: 'Glutes',     bg: 'bg-teal-500/20',    text: 'text-teal-400' },
  calves:      { label: 'Kuiten',     bg: 'bg-teal-400/20',    text: 'text-teal-300' },
  core:        { label: 'Core',       bg: 'bg-purple-500/20',  text: 'text-purple-400' },
  hip_flexors: { label: 'Heup',       bg: 'bg-violet-500/20',  text: 'text-violet-400' },
  rotator_cuff:{ label: 'Rotator',   bg: 'bg-pink-500/20',    text: 'text-pink-400' },
}

const DEFAULT = { label: '—', bg: 'bg-border-medium', text: 'text-label-tertiary' }

interface MuscleGroupDotProps {
  muscleGroup: string
  size?: 'sm' | 'md'
}

export function MuscleGroupDot({ muscleGroup, size = 'md' }: MuscleGroupDotProps) {
  const config = MUSCLE_COLORS[muscleGroup.toLowerCase()] ?? DEFAULT
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-9 w-9 text-[10px]'

  return (
    <div
      className={`${sizeClass} ${config.bg} ${config.text} flex shrink-0 items-center justify-center rounded-full font-semibold uppercase tracking-tight`}
      title={config.label}
    >
      {config.label.slice(0, 2)}
    </div>
  )
}

export function getMuscleLabel(muscleGroup: string): string {
  return (MUSCLE_COLORS[muscleGroup.toLowerCase()] ?? DEFAULT).label
}
