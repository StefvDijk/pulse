export type StepId = 'performance' | 'body' | 'reflection' | 'analysis' | 'next-block' | 'confirm'

export interface TemplateRating {
  focus: string
  rating: 'good' | 'ok' | 'meh' | null
  note: string
}

export interface ReflectionState {
  templateRatings: TemplateRating[]
  keepExercises: string[]
  dropExercises: string[]
  biggestWin: string
  biggestMiss: string
  injuryUpdates: Record<string, 'still_active' | 'resolved'>
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

export interface BlockReviewFormState {
  reflection: ReflectionState
  newInBody: NewInBodyState | null
  conversation: BlockReviewMessage[]
  aiAnalysis: string
  aiSchemaProposal: unknown | null
  schemaProposalVersion: number
  selectedGoals: NextBlockGoalDraft[]
  endReason: 'completed' | 'switched' | 'injury' | 'goal_reached' | 'time_up'
}
