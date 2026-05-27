export type StepId = 'performance' | 'body' | 'reflection' | 'analysis' | 'next-block' | 'confirm'

export interface TemplateRating {
  focus: string
  rating: 'good' | 'ok' | 'meh' | null
  volume: 'te_weinig' | 'goed' | 'te_veel' | null
  intensity: 'te_licht' | 'goed' | 'te_zwaar' | null
  motivation: 'hoog' | 'neutraal' | 'laag' | null
  recovery_cost: 'makkelijk' | 'normaal' | 'zwaar' | null
  time_pressure: boolean
  note: string
}

export interface ExerciseVerdict {
  name: string
  verdict: 'keep' | 'drop' | 'neutral'
  reason?: 'blessure' | 'stagnatie' | 'verveling' | 'techniek' | 'pijn'
  painScore?: number
}

export interface MissedSession {
  templateFocus: string
  week: number
  reason: 'ziek' | 'druk' | 'blessure' | 'motivatie' | 'vakantie' | 'overig'
}

export type InjuryReviewStatus = 'verbeterd' | 'stabiel' | 'verergerd' | 'flare_up_gehad' | 'opgelost'

export interface ReflectionState {
  templateRatings: TemplateRating[]
  exerciseVerdicts: ExerciseVerdict[]
  missedSessions: MissedSession[]
  keepExercises: string[]
  dropExercises: string[]
  biggestWin: string
  biggestMiss: string
  injuryUpdates: Record<string, InjuryReviewStatus>
}

export interface NewInBodyState {
  measuredAt: string
  weightKg: number | null
  skeletalMuscleMassKg: number | null
  fatMassKg: number | null
  fatPct: number | null
  visceralFatLevel: number | null
  waistCm: number | null
}

export interface NextBlockGoalDraft {
  id?: string
  title: string
  category: string
  targetValue?: number
  targetUnit?: string
  deadline?: string
  isNew: boolean
}

export interface BlockReviewMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProgramAuditItem {
  severity: 'blocker' | 'warning' | 'info'
  code: string
  message: string
  path?: string
  meta?: Record<string, unknown>
}

export interface ProgramAudit {
  items: ProgramAuditItem[]
  hasBlockers: boolean
}

export interface BlockReviewFormState {
  reflection: ReflectionState
  newInBody: NewInBodyState | null
  conversation: BlockReviewMessage[]
  aiAnalysis: string
  aiSchemaProposal: unknown | null
  aiProgramAudit: ProgramAudit | null
  schemaProposalVersion: number
  selectedGoals: NextBlockGoalDraft[]
  endReason: 'completed' | 'switched' | 'injury' | 'goal_reached' | 'time_up'
}
