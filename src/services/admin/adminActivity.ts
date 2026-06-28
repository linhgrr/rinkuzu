import type { AdminRecentAttempt } from '@/interfaces/services/IAdminService';

export function normalizeAdminRecentAttempt(attempt: unknown): AdminRecentAttempt {
  const value = attempt as {
    _id?: { toString(): string } | string;
    score?: number;
    takenAt?: Date;
    user?: { email?: string } | string | null;
    quiz?: { title?: string } | string | null;
  };
  const user =
    value.user && typeof value.user === 'object' && typeof value.user.email === 'string'
      ? { email: value.user.email }
      : null;
  const quiz =
    value.quiz && typeof value.quiz === 'object' && typeof value.quiz.title === 'string'
      ? { title: value.quiz.title }
      : null;

  return {
    id: value._id?.toString() ?? '',
    score: value.score ?? 0,
    takenAt: value.takenAt ?? new Date(0),
    user,
    quiz,
  };
}
