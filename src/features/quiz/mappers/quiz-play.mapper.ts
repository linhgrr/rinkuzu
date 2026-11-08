import type { QuizPlayDetailDto } from '@/dtos/quiz';
import { toQuizDetailBaseViewModel } from '@/features/quiz/mappers/quiz-detail-base.mapper';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';

export function toQuizPlayViewModel(dto: QuizPlayDetailDto): QuizPlayViewModel {
  return {
    ...toQuizDetailBaseViewModel(dto),
    questions: dto.questions.map((question) => ({
      ...copyQuizQuestionFields(question),
      type: question.type,
    })),
    ...(dto.retry ? { retry: dto.retry } : {}),
  };
}
