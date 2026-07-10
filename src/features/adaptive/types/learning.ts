import type { components } from '@/generated/adaptive-api';
import type { ReactNode } from 'react';

type ApiSchemas = components['schemas'];

export type BloomLevel = ApiSchemas['BloomLabel'];

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

export type NextConcept = ApiSchemas['NextConceptResponse'];

export type TheoryData = ApiSchemas['TheoryResponse'];

export type LearningStepApiResponse = ApiSchemas['LearningStepResponse'];

export type ExerciseApiResponse =
  | ApiSchemas['MCQExerciseResponse']
  | ApiSchemas['TrueFalseExerciseResponse']
  | ApiSchemas['FillBlankExerciseResponse']
  | ApiSchemas['MultiCorrectExerciseResponse']
  | ApiSchemas['OrderingExerciseResponse']
  | ApiSchemas['MatchingExerciseResponse']
  | ApiSchemas['ShortAnswerExerciseResponse'];

export type ExerciseType = ExerciseApiResponse['exercise_type'];

type RecommendationPrerequisite = ApiSchemas['RecommendationPrerequisite'];

type RecommendationReason = ApiSchemas['RecommendationReason'] & {
  satisfied_prereqs: RecommendationPrerequisite[];
};

export type SubmitAnswerPayload = ApiSchemas['SubmitAnswerPayload'];
export type SubmitAnswerRequest = ApiSchemas['SubmitAnswerRequest'];

type ExerciseCommon = Pick<
  ExerciseApiResponse,
  | 'exercise_id'
  | 'concept_name'
  | 'concept_idx'
  | 'bloom_level'
  | 'question'
  | 'step'
  | 'max_steps'
  | 'theory'
  | 'recommendation_reason'
>;

export type Exercise = ExerciseCommon & {
  id: string;
  exercise_type: ExerciseType;
  bloom_label: BloomLevel;
  sentence?: string | null;
  statement?: string | null;
  hint?: string | null;
  options: Record<string, string>;
  items: string[];
  pairs: ApiSchemas['MatchingPairPayload'][];
  right_items: string[];
  rubric?: string[];
  correct_answer?: string | string[] | boolean | Record<string, string> | null;
  theory?: TheoryData | null;
  recommendation_reason?: RecommendationReason | null;
};

export type SubmitResult = ApiSchemas['SubmitAnswerResponse'];

export type SessionStatus = ApiSchemas['SessionStatusResponse'];
