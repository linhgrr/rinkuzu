import type { AdminRecentAttemptDto } from '@/dtos/admin-stats';
import type { RecentAttemptActivity } from '@/interfaces/repositories/IAttemptRepository';
import { serializeDate } from '@/lib/date-serialization';

export class AdminActivityDtoMapper {
  static toRecentAttempt(attempt: RecentAttemptActivity): AdminRecentAttemptDto {
    const actor =
      attempt.userEmail !== undefined
        ? { email: attempt.userEmail, type: 'user' as const }
        : attempt.guestEmail !== undefined
          ? { email: attempt.guestEmail, type: 'guest' as const }
          : null;
    const quiz = attempt.quizTitle === undefined ? null : { title: attempt.quizTitle };

    if (!actor) {
      throw new TypeError('recentAttempt.actor is required');
    }
    if (!quiz) {
      throw new TypeError('recentAttempt.quiz is required');
    }

    return {
      id: attempt.id,
      score: attempt.score,
      takenAt: serializeDate(attempt.takenAt, 'recentAttempt.takenAt'),
      answeredQuestions: attempt.answeredQuestions,
      actor,
      quiz,
    };
  }
}
