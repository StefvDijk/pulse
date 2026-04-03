import type { QuestionType } from '@/lib/ai/classifier'
import { buildSchemaPrompt } from '@/lib/ai/prompts/schema-generation'
import { buildWeeklySummaryPrompt } from '@/lib/ai/prompts/weekly-summary'
import { buildWorkoutAnalysisSkill } from './workout-analysis'
import { buildRecoverySleepSkill } from './recovery-sleep'
import { buildGoalSettingSkill } from './goal-setting'

const RECOVERY_KEYWORDS = [
  'herstel', 'recovery', 'rust', 'moe', 'vermoeid', 'slaap', 'slapen',
  'hrv', 'hartslag', 'resting heart rate', 'moet ik trainen',
  'kan ik trainen', 'overtraind', 'overtraining', 'uitgerust',
  'energie', 'uitgeput',
]

const GOAL_KEYWORDS = [
  'doel', 'doelen', 'target', 'halen', 'bereiken', 'wil ik',
  'streven', 'ambitie', 'haalbaar', 'realistisch', 'deadline',
  'milestone', 'wanneer kan ik', 'wanneer haal ik',
]

const WORKOUT_ANALYSIS_KEYWORDS = [
  'workout', 'training', 'oefening', 'gewicht', 'reps', 'sets',
  'bench', 'squat', 'deadlift', 'pulldown', 'rdl', 'press',
  'sterker', 'zwaarder', 'plateau', 'progressie', 'volume',
  'tonnage', 'pr', 'record', 'hoe gaat', 'hoe ging',
]

function hasKeyword(message: string, keywords: readonly string[]): boolean {
  const lower = message.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

/**
 * Select relevant skill prompts based on question type and message content.
 * Returns an array of prompt strings to append to the system prompt.
 */
export function selectSkills(questionType: QuestionType, message: string): string[] {
  const skills: string[] = []

  // Question-type driven skills (always match)
  switch (questionType) {
    case 'schema_request':
      skills.push(buildSchemaPrompt({}))
      break
    case 'weekly_review':
      skills.push(buildWeeklySummaryPrompt({}))
      skills.push(buildWorkoutAnalysisSkill())
      break
    case 'progress_question':
      skills.push(buildWorkoutAnalysisSkill())
      break
  }

  // Keyword-driven skills (additive, avoid duplicates)
  if (hasKeyword(message, RECOVERY_KEYWORDS)) {
    skills.push(buildRecoverySleepSkill())
  }

  if (hasKeyword(message, GOAL_KEYWORDS)) {
    skills.push(buildGoalSettingSkill())
  }

  if (
    hasKeyword(message, WORKOUT_ANALYSIS_KEYWORDS) &&
    !skills.some((s) => s.includes('WORKOUT ANALYSE'))
  ) {
    skills.push(buildWorkoutAnalysisSkill())
  }

  return skills
}
