import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];

export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export type TranslationValues = Record<string, string | number | Date>;
export type TranslateFn = (key: string, values?: TranslationValues) => string;

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

export type NextConcept = Omit<ApiSchemas['NextConceptResponse'], 'bloom_label'> & {
  bloom_label: BloomLevel;
};

export type TheoryData = ApiSchemas['TheoryResponse'];

export type ExerciseType = ApiSchemas['ExerciseType'];

export interface MatchingPair {
  left: string;
  right: string;
}

export type RecommendationPrerequisite = ApiSchemas['RecommendationPrerequisite'];

export type RecommendationReason = Omit<ApiSchemas['RecommendationReason'], 'bloom_label'> & {
  bloom_label: BloomLevel;
  satisfied_prereqs: RecommendationPrerequisite[];
};

export type SubmitAnswerPayload = ApiSchemas['SubmitAnswerPayload'];

export type Exercise = Omit<
  ApiSchemas['ExerciseResponse'],
  'bloom_label' | 'options' | 'items' | 'pairs' | 'right_items' | 'theory' | 'recommendation_reason'
> & {
  id: string;
  bloom_label: BloomLevel;
  options: Record<string, string>;
  items: string[];
  pairs: MatchingPair[];
  right_items: string[];
  rubric?: string[];
  correct_answer?: string | string[] | boolean | Record<string, string> | null;
  theory?: TheoryData;
  recommendation_reason?: RecommendationReason | null;
};

export type SubmitResult = Omit<ApiSchemas['SubmitAnswerResponse'], 'stats'> & {
  stats: {
    total_correct: number;
    total_answered: number;
    accuracy: number;
  };
};

export type Session = Omit<ApiSchemas['SessionCreateResponse'], 'concepts'> & {
  concepts: ConceptInfo[];
};

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

export type SessionStatus = Omit<ApiSchemas['SessionStatusResponse'], 'exercises'> & {
  exercises: ExerciseHistoryItem[];
};

export interface DailyStats {
  exercisesCompleted: number;
  accuracy: number;
  timeSpentMinutes: number;
  conceptsLearned: number;
  streakDays: number;
}
