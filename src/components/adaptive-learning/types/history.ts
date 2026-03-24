export interface SubjectProgressItem {
  job_id: string
  filename: string
  subject_id: string
  status: string
  total_correct: number
  total_answered: number
  accuracy: number
  avg_mastery: number
  step: number
  max_steps: number
  updated_at: number
  created_at: number
  last_session_id?: string | null
}

export interface ExerciseHistoryFull {
  exercise_id: string
  concept_idx: number
  concept_name: string
  bloom_level: number
  question: string
  sentence?: string | null
  exercise_type?: string
  options: Record<string, string>
  statement?: string | null
  hint?: string | null
  items?: string[]
  pairs?: { left: string, right: string }[]
  right_items?: string[]
  rubric?: string[]
  correct_answer?: string | string[] | boolean | Record<string, string> | null
  correct_option: string
  explanation: string
  user_answer: string | null
  is_correct: boolean | null
  timestamp: number
}

export interface SubjectHistoryDetail {
  job_id: string
  filename: string
  subject_id: string
  status: string
  total_correct: number
  total_answered: number
  accuracy: number
  avg_mastery: number
  step: number
  max_steps: number
  concept_names: Record<string, string>
  concept_mastery: number[]
  bloom_mastery: number[][]
  exercise_history: ExerciseHistoryFull[]
  created_at: number
  updated_at: number
  last_session_id?: string | null
}

export type SessionHistoryItem = SubjectProgressItem
export type SessionHistoryDetail = SubjectHistoryDetail
