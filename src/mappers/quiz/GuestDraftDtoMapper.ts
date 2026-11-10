import type { GuestDraftPlayDto } from '@/dtos/guest-draft';
import type { QuizQuestion } from '@/entities/Quiz';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';

export class GuestDraftDtoMapper {
  /** The play view of a ready guest draft: question content and type, never the answers. */
  static toPlay(draft: { title: string; questions: QuizQuestion[] }): GuestDraftPlayDto {
    return {
      title: draft.title,
      questions: draft.questions.map((question) => ({
        ...copyQuizQuestionFields(question),
        type: question.type,
      })),
    };
  }
}
