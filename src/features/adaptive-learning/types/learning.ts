export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export const BLOOM_LABELS: BloomLevel[] = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

export interface Course {
  id: string;
  title: string;
  progress: number;
  totalConcepts: number;
  conceptsLearned: number;
  streak: number;
  lastAccessed: string;
  currentTopic: string;
}

export interface NextConcept {
  concept_name: string;
  concept_idx: number;
  bloom_level: number;
  bloom_label: BloomLevel;
  step: number;
  max_steps: number;
}

export interface TheoryData {
  content: string;
  examples: string[];
}

export type ExerciseType =
  | 'mcq'
  | 'true_false'
  | 'fill_blank'
  | 'multi_correct'
  | 'ordering'
  | 'matching'
  | 'short_answer';

export interface MatchingPair {
  left: string;
  right: string;
}

export interface RecommendationPrerequisite {
  name: string;
  mastery: number;
}

export interface RecommendationReason {
  concept_name: string;
  bloom_level: number;
  bloom_label: BloomLevel;
  satisfied_prereqs: RecommendationPrerequisite[];
  current_mastery: number;
  next_milestone: number;
}

export interface SubmitAnswerPayload {
  choice?: string;
  choices?: string[];
  boolean?: boolean;
  blanks?: string[];
  ordering?: string[];
  matching?: Record<string, string>;
  text?: string;
}

export interface Exercise {
  id: string;
  exercise_id: string;
  concept_name: string;
  concept_idx: number;
  bloom_level: number;
  bloom_label: BloomLevel;
  exercise_type: ExerciseType;
  question: string;
  sentence?: string | null;
  options: Record<string, string>;
  statement?: string | null;
  hint?: string | null;
  items: string[];
  pairs: MatchingPair[];
  right_items: string[];
  rubric?: string[];
  correct_answer?: string | string[] | boolean | Record<string, string> | null;
  step: number;
  max_steps: number;
  theory?: {
    content: string;
    examples: string[];
  };
  recommendation_reason?: RecommendationReason | null;
}

export interface SubmitResult {
  is_correct: boolean;
  correct_option: string;
  explanation: string;
  concept_name: string;
  bloom_level: number;
  mastery_after: number;
  avg_mastery: number;
  step: number;
  session_completed: boolean;
  stats: {
    total_correct: number;
    total_answered: number;
    accuracy: number;
  };
}

export interface Session {
  session_id: string;
  n_concepts: number;
  concepts: ConceptInfo[];
  status: string;
}

export interface ConceptInfo {
  id: string;
  name: string;
  index: number;
}

export interface ExerciseHistoryItem {
  exercise_id: string;
  concept_name: string;
  bloom_level: number;
  is_correct: boolean | null;
}

export interface SessionStatus {
  session_id: string;
  status: string;
  step: number;
  max_steps: number;
  concepts_visited: number;
  total_concepts: number;
  avg_mastery: number;
  coverage: number;
  total_correct: number;
  total_answered: number;
  accuracy: number;
  exercises: ExerciseHistoryItem[];
}

export interface DailyStats {
  exercisesCompleted: number;
  accuracy: number;
  timeSpentMinutes: number;
  conceptsLearned: number;
  streakDays: number;
}
