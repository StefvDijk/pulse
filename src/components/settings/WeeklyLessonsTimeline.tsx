'use client'

import { useWeeklyLessons, type WeeklyLessonEntry } from '@/hooks/useWeeklyLessons'
import { SectionHeader } from './shared'

const CATEGORY_LABELS: Record<string, string> = {
  program: 'Programma',
  lifestyle: 'Leefstijl',
  injury: 'Blessures',
  preference: 'Voorkeuren',
  pattern: 'Patronen',
  goal: 'Doelen',
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00Z`)
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  })
}

function LessonItem({ lesson }: { lesson: WeeklyLessonEntry }) {
  const label = CATEGORY_LABELS[lesson.category] ?? lesson.category
  return (
    <li className="relative pl-5">
      <span
        className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-system-blue"
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-xs font-medium text-label-tertiary">
          Week van {formatWeekLabel(lesson.week_start)}
        </span>
        <span className="rounded-full bg-system-gray6 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-label-secondary">
          {label}
        </span>
      </div>
      <p className="mt-1 text-sm text-label-primary">{lesson.lesson_text}</p>
    </li>
  )
}

export function WeeklyLessonsTimeline() {
  const { lessons, isLoading } = useWeeklyLessons()

  return (
    <div className="bg-surface-primary border border-separator rounded-[14px] p-[14px_16px]">
      <SectionHeader title="Wekelijkse lessen" />
      <p className="mb-3 text-xs text-label-tertiary">
        Inzichten die de coach elke week uit jouw data destilleert.
      </p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-system-gray6" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <p className="py-4 text-center text-sm text-label-tertiary">
          Nog geen wekelijkse lessen. De coach genereert deze elke zondag.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-4 border-l border-separator pl-2">
          {lessons.map((lesson) => (
            <LessonItem key={lesson.id} lesson={lesson} />
          ))}
        </ol>
      )}
    </div>
  )
}
