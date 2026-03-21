export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create'

export const BLOOM_LABELS: BloomLevel[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']

export interface Course {
  id: string
  title: string
  progress: number
  totalConcepts: number
  conceptsLearned: number
  streak: number
  lastAccessed: string
  currentTopic: string
}

export interface NextConcept {
  concept_name: string
  concept_idx: number
  bloom_level: number
  bloom_label: BloomLevel
  step: number
  max_steps: number
}

export interface TheoryData {
  content: string
  examples: string[]
}

export interface Exercise {
  id: string
  exercise_id: string
  concept_name: string
  concept_idx: number
  bloom_level: number
  bloom_label: BloomLevel
  question: string
  options: Record<string, string>
  step: number
  max_steps: number
  theory?: {
    content: string
    examples: string[]
  }
}

export interface SubmitResult {
  is_correct: boolean
  correct_option: string
  explanation: string
  concept_name: string
  bloom_level: number
  mastery_after: number
  avg_mastery: number
  step: number
  session_completed: boolean
  stats: {
    total_correct: number
    total_answered: number
    accuracy: number
  }
}

export interface Session {
  session_id: string
  n_concepts: number
  concepts: ConceptInfo[]
  status: string
}

export interface ConceptInfo {
  id: string
  name: string
  index: number
}

export interface ExerciseHistoryItem {
  exercise_id: string
  concept_name: string
  bloom_level: number
  is_correct: boolean | null
}

export interface SessionStatus {
  session_id: string
  status: string
  step: number
  max_steps: number
  concepts_visited: number
  total_concepts: number
  avg_mastery: number
  coverage: number
  total_correct: number
  total_answered: number
  accuracy: number
  exercises: ExerciseHistoryItem[]
}

export interface DailyStats {
  exercisesCompleted: number
  accuracy: number
  timeSpentMinutes: number
  conceptsLearned: number
  streakDays: number
}
