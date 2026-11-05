import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import type { QuizQuestion } from '@/entities/Quiz';
import type { RecordQuizAttemptProgressData } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import connectDB from '@/lib/mongoose';
import { UserAttemptDtoMapper } from '@/mappers/user/UserAttemptDtoMapper';
import AttemptModel from '@/models/Attempt';
import { AttemptRepository } from '@/repositories/AttemptRepository';
import { QuizAttemptProgressRepository } from '@/repositories/QuizAttemptProgressRepository';
import { deriveMissedQuestionIndices } from '@/services/quiz/quiz-retry';
import { evaluateQuizAttempt } from '@/services/quiz/quiz-attempt-evaluation';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-914: a retry-missed attempt is stored, deduped and read back like any attempt. */
describe('retry-missed attempt persistence', () => {
  const userId = new Types.ObjectId().toHexString();
  const quizId = new Types.ObjectId().toHexString();
  const slug = `retry-${randomUUID()}`;
  const questions: QuizQuestion[] = [0, 1, 2, 3].map((index) => ({
    id: new Types.ObjectId().toHexString(),
    question: `Fake question ${index}?`,
    options: ['a', 'b', 'c'],
    type: 'single',
    correctIndex: index % 3,
  }));
  const attempts = new QuizAttemptProgressRepository();
  const reads = new AttemptRepository();

  function submission(
    answers: number[],
    subset: QuizQuestion[],
    extra: Partial<RecordQuizAttemptProgressData> = {},
  ): RecordQuizAttemptProgressData {
    const evaluation = evaluateQuizAttempt(subset, answers);
    return {
      userId,
      idempotencyKey: randomUUID(),
      quizId,
      quizSlug: slug,
      quizSnapshot: { integrity: 'complete', title: 'Fake quiz', slug, questions: subset },
      answers: evaluation.answers,
      score: evaluation.score,
      correctAnswers: evaluation.correctAnswers,
      totalQuestions: evaluation.totalQuestions,
      wrongQuestions: evaluation.wrongQuestions,
      takenAt: new Date(),
      ...extra,
    } as RecordQuizAttemptProgressData;
  }

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

  it('stores the subset with its quiz indices, dedupes a resubmit and renders in history', async () => {
    // q0 right, q1 wrong, q2 right, q3 unanswered.
    const source = await attempts.recordSubmittedAttempt(submission([0, 0, 2, -1], questions));
    const sourceEntity = await reads.findByIdWithQuiz(source.id, { userId });
    if (!sourceEntity) throw new Error('source attempt not readable');
    const indices = deriveMissedQuestionIndices(sourceEntity, questions);
    expect(indices).toEqual([1, 3]);

    const subset = indices.map((index) => questions[index] as QuizQuestion);
    const retry = submission([1, 0], subset, {
      retryOfAttemptId: source.id,
      questionIndices: indices,
    });
    const stored = await attempts.recordSubmittedAttempt(retry);
    const again = await attempts.recordSubmittedAttempt({ ...retry, takenAt: new Date() });

    expect(again.id).toBe(stored.id);
    expect(stored).toMatchObject({ totalQuestions: 2, correctAnswers: 2, score: 100 });

    const entity = await reads.findByIdWithQuiz(stored.id, { userId });
    expect(entity).toMatchObject({ retryOfAttemptId: source.id, questionIndices: [1, 3] });
    if (!entity) throw new Error('retry attempt not readable');
    const detail = UserAttemptDtoMapper.toDetailDto(entity);
    expect(detail.historyStatus).toBe('complete');
    expect(detail.quiz.questions.map((question) => question.question)).toEqual([
      'Fake question 1?',
      'Fake question 3?',
    ]);
    expect(detail.quiz.questions.every((question) => question.isCorrect)).toBe(true);
    expect(detail).toMatchObject({ missedCount: 0, questionIndices: [1, 3] });

    await expect(reads.findAttemptedQuizSlugs({ userId }, [slug, 'never-played'])).resolves.toEqual(
      [slug],
    );
  }, 20_000);

  it('rejects a retry attempt whose mapping does not match its answers', async () => {
    const subset = [questions[1] as QuizQuestion];
    await expect(
      AttemptModel.create({
        user: userId,
        idempotencyKey: randomUUID(),
        submissionDigest: 'a'.repeat(64),
        quiz: quizId,
        quizSnapshot: { integrity: 'complete', title: 'Fake quiz', slug, questions: subset },
        answers: [{ kind: 'single', selectedIndex: 1 }],
        score: 100,
        correctAnswers: 1,
        totalQuestions: 1,
        retryOfAttemptId: new Types.ObjectId(),
        questionIndices: [1, 3],
      }),
    ).rejects.toThrow(/questionIndices/);
  });
});
