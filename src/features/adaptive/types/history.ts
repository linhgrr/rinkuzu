import type { components } from '@/generated/adaptive-api';
import type { PipelineStatus } from '@/features/adaptive/types/pipeline';
import type { ExerciseType } from '@/features/adaptive/types/learning';

type ApiSchemas = components['schemas'];

export type SubjectProgressItem = Omit<ApiSchemas['SubjectProgressSummaryResponse'], 'status'> & {
  status: PipelineStatus;
};

export interface ExerciseHistoryFull {
  exercise_id: string;
  concept_idx: number;
  concept_name: string;
  bloom_level: number;
  question: string;
  sentence?: string | null;
  exercise_type: ExerciseType;
  options: Record<string, string>;
  statement?: string | null;
  hint?: string | null;
  items: string[];
  pairs: { left: string; right: string }[];
  right_items: string[];
  rubric?: string[];
  correct_answer?: string | string[] | boolean | Record<string, string> | null;
  correct_option: string;
  explanation: string;
  user_answer: string | null;
  is_correct: boolean | null;
  timestamp: number;
}

export type SubjectHistoryDetail = Omit<
  ApiSchemas['SubjectHistoryDetailResponse'],
  'exercise_history' | 'status'
> & {
  status: PipelineStatus;
  exercise_history: ExerciseHistoryFull[];
};

export type SessionHistoryItem = SubjectProgressItem;
export type SessionHistoryDetail = SubjectHistoryDetail;
