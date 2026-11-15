import type { GuestDraftPlayDto } from '@/dtos/guest-draft';
import type { GuestDraftQuiz } from '@/interfaces/repositories/IGuestQuizDraftRepository';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';

export class GuestDraftDtoMapper {
  /** The play view of a ready guest draft: question content and type, never the answers. */
  static toPlay(draft: Omit<GuestDraftQuiz, 'id'>): GuestDraftPlayDto {
    return {
      title: draft.title,
      questions: draft.questions.map((question) => ({
        ...copyQuizQuestionFields(question),
        type: question.type,
      })),
      complete: draft.complete,
      completion: draft.completion,
    };
  }
}
