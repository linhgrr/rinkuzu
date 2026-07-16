import type { AttemptDetailDto } from '@/dtos/user';
import type { AttemptDetailViewModel } from '@/features/profile/types/attempt-detail-view-model';
import { formatDateTime } from '@/lib/formatters';

function toAttemptQuestionViewModel(question: AttemptDetailDto['quiz']['questions'][number]) {
  const base = {
    id: question.id,
    question: question.question,
    options: question.options,
    ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
    ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
    userAnswer: question.userAnswer,
    isCorrect: question.isCorrect,
  };

  return question.type === 'single'
    ? {
        ...base,
        type: 'single' as const,
        ...(question.correctIndex !== undefined && { correctIndex: question.correctIndex }),
      }
    : {
        ...base,
        type: 'multiple' as const,
        ...(question.correctIndexes !== undefined && { correctIndexes: question.correctIndexes }),
      };
}

export function toAttemptDetailViewModel(
  dto: AttemptDetailDto,
  locale: string,
): AttemptDetailViewModel {
  return {
    id: dto.id,
    score: dto.score,
    totalQuestions: dto.totalQuestions,
    takenAt: dto.takenAt,
    takenAtLabel: formatDateTime(dto.takenAt, {
      locale,
      options: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    }),
    answers: dto.answers,
    historyStatus: dto.historyStatus,
    quiz: {
      title: dto.quiz.title,
      slug: dto.quiz.slug,
      ...(dto.quiz.description !== undefined && { description: dto.quiz.description }),
      questions: dto.quiz.questions.map(toAttemptQuestionViewModel),
    },
  };
}
