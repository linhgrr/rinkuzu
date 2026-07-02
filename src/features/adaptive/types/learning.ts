import type { components } from '@/generated/adaptive-api';
import type { ReactNode } from 'react';

type ApiSchemas = components['schemas'];

export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export type TranslationValues = Record<string, string | number | Date>;
export type TranslateFn = (key: string, values?: TranslationValues) => string;
export type RichTranslationValues = Record<
  string,
  string | number | Date | ((chunks: ReactNode) => ReactNode)
>;
export type RichTranslateFn = TranslateFn & {
  rich: (key: string, values: RichTranslationValues) => ReactNode;
};

export const BLOOM_LABELS: BloomLevel[] = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

export type NextConcept = Omit<ApiSchemas['NextConceptResponse'], 'bloom_label'> & {
  bloom_label: BloomLevel;
};

export type TheoryData = ApiSchemas['TheoryResponse'];
export type ExerciseType = ApiSchemas['ExerciseType'];

interface MatchingPair {
  left: string;
  right: string;
}

type RecommendationPrerequisite = ApiSchemas['RecommendationPrerequisite'];

type RecommendationReason = Omit<ApiSchemas['RecommendationReason'], 'bloom_label'> & {
  bloom_label: BloomLevel;
  satisfied_prereqs: RecommendationPrerequisite[];
};

export type SubmitAnswerPayload = ApiSchemas['SubmitAnswerPayload'];

export type Exercise = Omit<
  ApiSchemas['ExerciseResponse'],
  'bloom_label' | 'options' | 'items' | 'pairs' | 'right_items' | 'theory' | 'recommendation_reason'
> & {
  id: string;
  exercise_type: ExerciseType;
  bloom_label: BloomLevel;
  options: Record<string, string>;
  items: string[];
  pairs: MatchingPair[];
  right_items: string[];
  rubric?: string[];
  correct_answer?: string | string[] | boolean | Record<string, string> | null;
  theory?: TheoryData | null;
  recommendation_reason?: RecommendationReason | null;
};

export type SubmitResult = Omit<ApiSchemas['SubmitAnswerResponse'], 'stats'> & {
  stats: {
    total_correct: number;
    total_answered: number;
    accuracy: number;
  };
};

export type SessionStatus = ApiSchemas['SessionStatusResponse'];
