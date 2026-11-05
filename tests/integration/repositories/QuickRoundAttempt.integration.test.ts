import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import type { QuizQuestion } from '@/entities/Quiz';
import connectDB from '@/lib/mongoose';
import { UserAttemptDtoMapper } from '@/mappers/user/UserAttemptDtoMapper';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { deriveMissedQuestionIndices } from '@/services/quiz/quiz-retry';
import { evaluateQuizAttempt } from '@/services/quiz/quiz-attempt-evaluation';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-936: a quick round is stored, deduped and read back like any attempt. */
describe('quick round attempt persistence', () => {
  const userId = new Types.ObjectId().toHexString();
  const quizId = new Types.ObjectId().toHexString();
  const slug = `quick-${randomUUID()}`;
  const questions: QuizQuestion[] = Array.from({ length: 16 }, (_, index) => ({
    id: new Types.ObjectId().toHexString(),
    question: `Fake question ${index}?`,
    options: ['a', 'b', 'c'],
    type: 'single',
    correctIndex: index % 3,
  }));
  const playOrder = [15, 2, 9, 0, 11, 5, 14, 7, 3, 12];
  const attempts = new QuizAttemptProgressRepository();
  const reads = new AttemptRepository();

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
  }, 15_000);

  afterAll(async () => {
    const db = mongoose.connection;
    await Promise.all([
      db.collection('attempts').deleteMany({ user: new Types.ObjectId(userId) }),
      db.collection('userprogresses').deleteMany({ userId: new Types.ObjectId(userId) }),
      db.collection('questionprogresses').deleteMany({ quizSlug: slug }),
    ]);
  }, 10_000);

  it('stores mode and play-order indices, dedupes a resubmit, reads back and retries only its misses', async () => {
    const played = playOrder.map((index) => questions[index] as QuizQuestion);
    // First 8 right, last 2 wrong: 8/10.
    const answers = playOrder.map((index, position) =>
      position < 8 ? index % 3 : (index + 1) % 3,
    );
    const evaluation = evaluateQuizAttempt(played, answers);
    const quick = {
      userId,
      idempotencyKey: randomUUID(),
      quizId,
      quizSlug: slug,
      quizSnapshot: { integrity: 'complete' as const, title: 'Fake quiz', slug, questions: played },
      ...evaluation,
      takenAt: new Date(),
      mode: 'quick' as const,
      questionIndices: playOrder,
    };

    const stored = await attempts.recordSubmittedAttempt(quick);
    const again = await attempts.recordSubmittedAttempt({ ...quick, takenAt: new Date() });

    expect(again.id).toBe(stored.id);
    expect(stored).toMatchObject({ totalQuestions: 10, correctAnswers: 8, score: 80 });

    const entity = await reads.findByIdWithQuiz(stored.id, { userId });
    if (!entity) throw new Error('quick attempt not readable');
    expect(entity).toMatchObject({ mode: 'quick', questionIndices: playOrder });
    expect(entity).not.toHaveProperty('retryOfAttemptId');
    const detail = UserAttemptDtoMapper.toDetailDto(entity);
    expect(detail).toMatchObject({ historyStatus: 'complete', mode: 'quick', missedCount: 2 });
    expect(detail.quiz.questions.map((question) => question.question)).toEqual(
      playOrder.map((index) => `Fake question ${index}?`),
    );

    const history = await reads.findByUser(userId, { page: 1, limit: 10 });
    const [latest] = history.items;
    if (!latest) throw new Error('quick attempt missing from history');
    expect(UserAttemptDtoMapper.toSummaryDto(latest)).toMatchObject({
      id: stored.id,
      mode: 'quick',
      totalQuestions: 10,
    });

    // Missed: play positions 8 and 9, i.e. quiz questions 3 and 12; nothing outside the round.
    expect(deriveMissedQuestionIndices(entity, questions)).toEqual([3, 12]);
  }, 20_000);
});
