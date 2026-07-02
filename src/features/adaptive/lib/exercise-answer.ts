import { buildInitialMatchingAnswer } from '@/features/adaptive/lib/matching-answer';
import type { ExerciseAnswerDraft } from '@/features/adaptive/types/exercise-answer';
import type { Exercise } from '@/features/adaptive/types/learning';

export function createInitialExerciseAnswer(exercise: Exercise): ExerciseAnswerDraft {
  switch (exercise.exercise_type) {
    case 'mcq':
      return { type: exercise.exercise_type, selection: null };
    case 'true_false':
      return { type: exercise.exercise_type, value: null };
    case 'fill_blank':
      return { type: exercise.exercise_type, values: [''] };
    case 'multi_correct':
      return { type: exercise.exercise_type, selections: [] };
    case 'ordering':
      return { type: exercise.exercise_type, items: [...exercise.items] };
    case 'matching':
      return {
        type: exercise.exercise_type,
        matches: buildInitialMatchingAnswer(exercise),
      };
    case 'short_answer':
      return { type: exercise.exercise_type, text: '' };
  }
}

export function hasCompleteExerciseAnswer(
  exercise: Exercise,
  answer: ExerciseAnswerDraft,
): boolean {
  if (exercise.exercise_type !== answer.type) {
    throw new TypeError(
      `Exercise type ${exercise.exercise_type} does not match answer type ${answer.type}`,
    );
  }

  switch (answer.type) {
    case 'mcq':
      return answer.selection !== null && answer.selection.length > 0;
    case 'true_false':
      return answer.value !== null;
    case 'fill_blank':
      return answer.values.some((value) => value.trim().length > 0);
    case 'multi_correct':
      return answer.selections.length > 0;
    case 'ordering':
      return answer.items.length === exercise.items.length;
    case 'matching': {
      const expectedLeftItems = new Set(exercise.pairs.map((pair) => pair.left));
      const submittedMatches = Object.entries(answer.matches);
      return (
        submittedMatches.length === expectedLeftItems.size &&
        submittedMatches.every(([left, right]) => expectedLeftItems.has(left) && right.length > 0)
      );
    }
    case 'short_answer':
      return answer.text.trim().length > 0;
  }
}
