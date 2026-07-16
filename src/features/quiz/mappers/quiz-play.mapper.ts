import type { QuizPlayDetailDto } from '@/dtos/quiz';
import { toQuizDetailBaseViewModel } from '@/features/quiz/mappers/quiz-detail-base.mapper';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';

export function toQuizPlayViewModel(dto: QuizPlayDetailDto): QuizPlayViewModel {
  return {
    ...toQuizDetailBaseViewModel(dto),
    questions: dto.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options,
      type: question.type,
      ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
      ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
    })),
  };
}
