import type { ExerciseType } from '@/features/adaptive/types/learning';

export type ExerciseAnswerDraft =
  | { type: Extract<ExerciseType, 'mcq'>; selection: string | null }
  | { type: Extract<ExerciseType, 'true_false'>; value: boolean | null }
  | { type: Extract<ExerciseType, 'fill_blank'>; values: [string] }
  | { type: Extract<ExerciseType, 'multi_correct'>; selections: string[] }
  | { type: Extract<ExerciseType, 'ordering'>; items: string[] }
  | { type: Extract<ExerciseType, 'matching'>; matches: Record<string, string> }
  | { type: Extract<ExerciseType, 'short_answer'>; text: string };
