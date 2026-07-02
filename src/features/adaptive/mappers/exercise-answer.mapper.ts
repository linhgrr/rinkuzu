import type { ExerciseAnswerDraft } from '@/features/adaptive/types/exercise-answer';
import type { SubmitAnswerPayload } from '@/features/adaptive/types/learning';

export function toSubmitAnswerPayload(answer: ExerciseAnswerDraft): SubmitAnswerPayload {
  switch (answer.type) {
    case 'mcq':
      return { choice: answer.selection };
    case 'true_false':
      return { boolean: answer.value };
    case 'fill_blank':
      return { blanks: answer.values };
    case 'multi_correct':
      return { choices: answer.selections };
    case 'ordering':
      return { ordering: answer.items };
    case 'matching':
      return { matching: answer.matches };
    case 'short_answer':
      return { text: answer.text };
  }
}
