import type { Exercise } from '@/features/adaptive/types';
import type { ExerciseHistoryFull } from '@/features/adaptive/types/history';

/*
Prompt contract used across current exercise, history detail, and chat context.

Per exercise type:
- mcq, multi_correct, ordering, matching, short_answer:
  question = main prompt shown to the learner
- true_false:
  question = lead/instruction
  statement = primary prompt the learner judges
- fill_blank:
  question = lead/instruction
  sentence = primary prompt containing the blank

Rule:
- `lead` is shown only when it adds information beyond `primary`
- `primary` is the prompt block the learner directly acts on
*/

type ExercisePromptLike = Pick<Exercise, 'exercise_type' | 'question' | 'statement' | 'sentence'>;
type ExercisePromptSections = {
  lead: string | null;
  primary: string;
};

function normalizePromptText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getExercisePromptSections(
  exercise: ExercisePromptLike | ExerciseHistoryFull,
): ExercisePromptSections {
  const question = normalizePromptText(exercise.question) || '';
  const statement = normalizePromptText(exercise.statement);
  const sentence = normalizePromptText(exercise.sentence);

  if (exercise.exercise_type === 'true_false' && statement) {
    return {
      lead: question && question !== statement ? question : null,
      primary: statement,
    };
  }

  if (exercise.exercise_type === 'fill_blank' && sentence) {
    return {
      lead: question && question !== sentence ? question : null,
      primary: sentence,
    };
  }

  return {
    lead: null,
    primary: question,
  };
}

export function buildExercisePromptText(
  exercise: ExercisePromptLike | ExerciseHistoryFull,
): string {
  const sections = getExercisePromptSections(exercise);
  return sections.lead ? `${sections.lead}\n${sections.primary}` : sections.primary;
}
