import type { components } from '@/generated/adaptive-api';
import type { ExerciseType } from '@/features/adaptive/types/learning';

type ApiSchemas = components['schemas'];

export type SubjectProgressStatus = ApiSchemas['SubjectProgressStatus'];

export type SubjectProgressItem = ApiSchemas['SubjectProgressSummaryResponse'];

export type ExerciseHistoryFull = Omit<ApiSchemas['ExerciseHistoryResponse'], 'payload'> & {
  exercise_type: ExerciseType;
  sentence?: string | null;
  options: Record<string, string>;
  statement?: string | null;
  hint?: string | null;
  items: string[];
  pairs: { left: string; right: string }[];
  right_items: string[];
  rubric?: string[];
  correct_answer?: string | string[] | boolean | Record<string, string> | null;
  correct_option: string;
};

export type SubjectHistoryDetail = Omit<
  ApiSchemas['SubjectHistoryDetailResponse'],
  'exercise_history'
> & {
  exercise_history: ExerciseHistoryFull[];
};

export type SessionHistoryItem = SubjectProgressItem;
export type SessionHistoryDetail = SubjectHistoryDetail;
