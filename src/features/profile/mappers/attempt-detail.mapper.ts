import type { AttemptDetailDto } from '@/dtos/user';
import type { AttemptDetailViewModel } from '@/features/profile/types/attempt-detail-view-model';
import { formatDateTime } from '@/lib/formatters';

export function toAttemptDetailViewModel(
  dto: AttemptDetailDto,
  locale: string,
): AttemptDetailViewModel {
  return {
    id: dto.id,
    score: dto.score,
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
    quiz: {
      title: dto.quiz.title,
      slug: dto.quiz.slug,
      description: dto.quiz.description,
      questions: dto.quiz.questions.map((question) => ({ ...question })),
    },
  };
}
