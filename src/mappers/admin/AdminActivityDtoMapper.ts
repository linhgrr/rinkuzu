import type { Attempt, AttemptQuizSnapshot, AttemptUserPreview } from '@/entities/Attempt';
import type { AdminRecentAttemptDto } from '@/dtos/admin-stats';
import { serializeDate } from '@/lib/date-serialization';
import { countAnsweredAttemptQuestions } from '@/lib/attempt/answers';

function isUserPreview(user: Attempt['user']): user is AttemptUserPreview {
  return typeof user === 'object' && user !== null;
}

function isQuizSnapshot(quiz: Attempt['quiz']): quiz is AttemptQuizSnapshot {
  return typeof quiz === 'object' && quiz !== null;
}

export class AdminActivityDtoMapper {
  static toRecentAttempt(attempt: Attempt): AdminRecentAttemptDto {
    const actor = isUserPreview(attempt.user)
      ? { email: attempt.user.email, type: 'user' as const }
      : attempt.guestEmail
        ? { email: attempt.guestEmail, type: 'guest' as const }
        : null;
    const quiz = isQuizSnapshot(attempt.quiz) ? { title: attempt.quiz.title } : null;

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
      answeredQuestions: countAnsweredAttemptQuestions(attempt.answers),
      actor,
      quiz,
    };
  }
}
