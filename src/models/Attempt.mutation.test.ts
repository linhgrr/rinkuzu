import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import Attempt from '@/models/Attempt';

const USER_ID = '507f191e810c19729de860eb';
const QUIZ_ID = '507f191e810c19729de860ea';

function baseSnapshot(questionCount = 1) {
  return {
    integrity: 'complete' as const,
    title: 'Quiz',
    slug: 'quiz',
    questions: Array.from({ length: questionCount }, (_, index) => ({
      question: `Question ${index + 1}?`,
      options: ['A', 'B'],
      type: 'single' as const,
      correctIndex: 0,
    })),
  };
}

function baseSubmission(overrides: Record<string, unknown> = {}) {
  const totalQuestions = 1;
  return {
    user: USER_ID,
    idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
    submissionDigest: 'a'.repeat(64),
    quiz: QUIZ_ID,
    quizSnapshot: baseSnapshot(totalQuestions),
    score: 100,
    correctAnswers: 1,
    totalQuestions,
    answers: [{ kind: 'single', selectedIndex: 0 }],
    ...overrides,
  };
}

async function expectReject(payload: Record<string, unknown>, message: string | RegExp) {
  const attempt = new Attempt(payload);
  await expect(attempt.validate()).rejects.toThrow(message);
}

async function expectPathError(
  payload: Record<string, unknown>,
  path: string,
  message: string | RegExp,
) {
  const attempt = new Attempt(payload);
  let caught: unknown;
  try {
    await attempt.validate();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(mongoose.Error.ValidationError);
  const validationError = caught as mongoose.Error.ValidationError;
  expect(validationError.errors[path]).toBeDefined();
  expect(validationError.errors[path]?.message).toMatch(message);
}

describe('Attempt mutation coverage', () => {
  describe('identity and contact fields', () => {
    it('requires exactly one of user or guestEmail', async () => {
      await expectReject(
        { ...baseSubmission(), user: undefined },
        'Exactly one attempt identity is required',
      );
      await expectReject(
        { ...baseSubmission(), guestEmail: 'guest@example.com' },
        'Exactly one attempt identity is required',
      );

      const userAttempt = new Attempt(baseSubmission());
      await expect(userAttempt.validate()).resolves.toBeUndefined();
      expect(userAttempt.user).toBeInstanceOf(mongoose.Types.ObjectId);

      const guestAttempt = new Attempt({
        ...baseSubmission(),
        user: undefined,
        guestEmail: 'Guest@Example.COM',
      });
      await expect(guestAttempt.validate()).resolves.toBeUndefined();
      expect(guestAttempt.guestEmail).toBe('guest@example.com');
      expect(guestAttempt.user).toBeUndefined();
    });

    it('rejects invalid guest email shapes with the production message', async () => {
      await expectReject(
        {
          ...baseSubmission(),
          user: undefined,
          guestEmail: 'not-an-email',
        },
        'Guest email is invalid',
      );

      await expectReject(
        {
          ...baseSubmission(),
          user: undefined,
          guestEmail: 'missing-domain@',
        },
        'Guest email is invalid',
      );
    });
  });

  describe('immutable submission identifiers', () => {
    it('requires idempotency keys between 16 and 128 characters', async () => {
      await expectReject(
        { ...baseSubmission(), idempotencyKey: undefined },
        'Idempotency key is required',
      );
      await expectReject(
        { ...baseSubmission(), idempotencyKey: 'short-key' },
        /shorter than the minimum allowed length|is shorter than the minimum/,
      );

      const longKey = 'k'.repeat(128);
      const valid = new Attempt({ ...baseSubmission(), idempotencyKey: longKey });
      await expect(valid.validate()).resolves.toBeUndefined();

      await expectReject(
        { ...baseSubmission(), idempotencyKey: 'k'.repeat(129) },
        /longer than the maximum allowed length|is longer than the maximum/,
      );
    });

    it('requires a 64-character lowercase hex submission digest', async () => {
      await expectReject(
        { ...baseSubmission(), submissionDigest: undefined },
        'Submission digest is required',
      );
      await expectReject(
        { ...baseSubmission(), submissionDigest: 'A'.repeat(64) },
        'Submission digest must be a SHA-256 hex digest',
      );
      await expectReject(
        { ...baseSubmission(), submissionDigest: 'a'.repeat(63) },
        'Submission digest must be a SHA-256 hex digest',
      );
      await expectReject(
        { ...baseSubmission(), submissionDigest: `${'a'.repeat(63)}g` },
        'Submission digest must be a SHA-256 hex digest',
      );

      const valid = new Attempt({
        ...baseSubmission(),
        submissionDigest: '0123456789abcdef'.repeat(4),
      });
      await expect(valid.validate()).resolves.toBeUndefined();
    });

    it('requires quiz and quizSnapshot references', async () => {
      await expectReject({ ...baseSubmission(), quiz: undefined }, 'Quiz is required');
      await expectReject(
        { ...baseSubmission(), quizSnapshot: undefined },
        'Quiz snapshot is required',
      );
    });
  });

  describe('quiz snapshot constraints', () => {
    it('requires complete integrity, non-empty questions, and trimmed title/slug bounds', async () => {
      await expectReject(
        {
          ...baseSubmission(),
          quizSnapshot: {
            ...baseSnapshot(),
            integrity: 'partial',
            questions: baseSnapshot().questions,
          },
        },
        /is not a valid enum value|`partial` is not a valid enum value/,
      );

      await expectReject(
        {
          ...baseSubmission(),
          totalQuestions: 0,
          answers: [],
          correctAnswers: 0,
          score: 0,
          quizSnapshot: { ...baseSnapshot(), questions: [] },
        },
        'Quiz snapshots require at least one question',
      );

      await expectReject(
        {
          ...baseSubmission(),
          quizSnapshot: { ...baseSnapshot(), title: 't'.repeat(201) },
        },
        /longer than the maximum allowed length|is longer than the maximum/,
      );

      const withDescription = new Attempt({
        ...baseSubmission(),
        quizSnapshot: {
          ...baseSnapshot(),
          title: '  Algebra  ',
          slug: 'Algebra-Basics',
          description: '  Intro  ',
        },
      });
      await expect(withDescription.validate()).resolves.toBeUndefined();
      expect(withDescription.quizSnapshot.title).toBe('Algebra');
      expect(withDescription.quizSnapshot.slug).toBe('algebra-basics');
      expect(withDescription.quizSnapshot.description).toBe('Intro');
    });
  });

  describe('scoring contract', () => {
    it('requires totalQuestions to match the immutable snapshot length', async () => {
      await expectReject(
        {
          ...baseSubmission(),
          totalQuestions: 2,
          answers: [
            { kind: 'single', selectedIndex: 0 },
            { kind: 'single', selectedIndex: 1 },
          ],
          correctAnswers: 1,
          score: 50,
        },
        'Total questions must match the immutable quiz snapshot',
      );
    });

    it('requires answer count to match total questions', async () => {
      await expectReject(
        {
          ...baseSubmission(),
          answers: [],
          correctAnswers: 0,
          score: 0,
        },
        'Answer count must match total questions',
      );
    });

    it('rejects correctAnswers that exceed totalQuestions', async () => {
      await expectReject(
        {
          ...baseSubmission(),
          correctAnswers: 2,
          score: 100,
        },
        'Correct answer count cannot exceed total questions',
      );
    });

    it('requires score and correctAnswers to match evaluated answers', async () => {
      const twoQuestion = baseSubmission({
        quizSnapshot: baseSnapshot(2),
        totalQuestions: 2,
        answers: [
          { kind: 'single', selectedIndex: 0 },
          { kind: 'single', selectedIndex: 1 },
        ],
        correctAnswers: 1,
        score: 50,
      });
      const valid = new Attempt(twoQuestion);
      await expect(valid.validate()).resolves.toBeUndefined();

      await expectReject(
        { ...twoQuestion, score: 49 },
        'Score must match the correct answer count',
      );

      // 1/3 => 33.333... rounds to 33
      const threeQuestion = baseSubmission({
        quizSnapshot: baseSnapshot(3),
        totalQuestions: 3,
        answers: [
          { kind: 'single', selectedIndex: 0 },
          { kind: 'single', selectedIndex: 1 },
          { kind: 'single', selectedIndex: 1 },
        ],
        correctAnswers: 1,
        score: 33,
      });
      await expect(new Attempt(threeQuestion).validate()).resolves.toBeUndefined();
      await expectReject(
        { ...threeQuestion, score: 34 },
        'Score must match the correct answer count',
      );

      await expectReject(
        { ...baseSubmission(), score: -1, correctAnswers: 1 },
        /Score cannot be negative|Score must match/,
      );
      await expectReject(
        {
          ...baseSubmission({
            quizSnapshot: baseSnapshot(2),
            totalQuestions: 2,
            answers: [
              { kind: 'single', selectedIndex: 0 },
              { kind: 'single', selectedIndex: 0 },
            ],
            correctAnswers: 2,
            score: 101,
          }),
        },
        /Score cannot exceed 100|Score must match/,
      );
    });

    it('isolates field min/max messages so cross-field hooks cannot mask them', async () => {
      await expectPathError(
        {
          ...baseSubmission(),
          totalQuestions: 0,
          answers: [],
          correctAnswers: 0,
          score: 0,
          quizSnapshot: baseSnapshot(1),
        },
        'totalQuestions',
        'Total questions must be positive',
      );

      await expectPathError(
        {
          ...baseSubmission(),
          correctAnswers: -1,
          score: 0,
        },
        'correctAnswers',
        'Correct answer count cannot be negative',
      );

      await expectPathError(
        {
          ...baseSubmission(),
          correctAnswers: 1.5,
          score: 100,
        },
        'correctAnswers',
        'Correct answer count must be an integer',
      );
    });

    it('rejects empty answers and defaults takenAt when omitted', async () => {
      // A missing answers field is cast to [] before required validators fire,
      // so the contract hook reports the count mismatch.
      await expectReject(
        { ...baseSubmission(), answers: [] },
        'Answer count must match total questions',
      );

      const attempt = new Attempt(baseSubmission({ takenAt: undefined }));
      await expect(attempt.validate()).resolves.toBeUndefined();
      expect(attempt.takenAt).toBeInstanceOf(Date);
    });
  });

  describe('answer integrity against quiz snapshot', () => {
    it('accepts valid single, multiple, and unanswered answers', async () => {
      const single = new Attempt(baseSubmission());
      await expect(single.validate()).resolves.toBeUndefined();

      const multiple = new Attempt(
        baseSubmission({
          quizSnapshot: {
            integrity: 'complete',
            title: 'Quiz',
            slug: 'quiz',
            questions: [
              {
                question: 'Pick all primes',
                options: ['2', '3', '4'],
                type: 'multiple',
                correctIndexes: [0, 1],
              },
            ],
          },
          answers: [{ kind: 'multiple', selectedIndexes: [1, 0] }],
          correctAnswers: 1,
          score: 100,
        }),
      );
      await expect(multiple.validate()).resolves.toBeUndefined();

      const unanswered = new Attempt(
        baseSubmission({
          answers: [{ kind: 'single', selectedIndex: null }],
          correctAnswers: 0,
          score: 0,
        }),
      );
      await expect(unanswered.validate()).resolves.toBeUndefined();

      const unansweredMultiple = new Attempt(
        baseSubmission({
          quizSnapshot: {
            integrity: 'complete',
            title: 'Quiz',
            slug: 'quiz',
            questions: [
              {
                question: 'Pick all primes',
                options: ['2', '3', '4'],
                type: 'multiple',
                correctIndexes: [0, 1],
              },
            ],
          },
          answers: [{ kind: 'multiple', selectedIndexes: [] }],
          correctAnswers: 0,
          score: 0,
        }),
      );
      await expect(unansweredMultiple.validate()).resolves.toBeUndefined();
    });

    it('rejects forged correctAnswers and score for a wrong selected answer', async () => {
      await expectPathError(
        baseSubmission({
          answers: [{ kind: 'single', selectedIndex: 1 }],
          correctAnswers: 1,
          score: 100,
        }),
        'correctAnswers',
        'Correct answer count must match evaluated answers',
      );

      await expectPathError(
        baseSubmission({
          answers: [{ kind: 'single', selectedIndex: 1 }],
          correctAnswers: 0,
          score: 100,
        }),
        'score',
        'Score must match the correct answer count',
      );
    });

    it('rejects kind mismatch with a precise path and message', async () => {
      await expectPathError(
        baseSubmission({
          answers: [{ kind: 'multiple', selectedIndexes: [0] }],
          correctAnswers: 0,
          score: 0,
        }),
        'answers.0.kind',
        'Answer kind must match the quiz snapshot question type',
      );

      await expectPathError(
        baseSubmission({
          quizSnapshot: {
            integrity: 'complete',
            title: 'Quiz',
            slug: 'quiz',
            questions: [
              {
                question: 'Pick all',
                options: ['A', 'B', 'C'],
                type: 'multiple',
                correctIndexes: [0, 1],
              },
            ],
          },
          answers: [{ kind: 'single', selectedIndex: 0 }],
          correctAnswers: 0,
          score: 0,
        }),
        'answers.0.kind',
        'Answer kind must match the quiz snapshot question type',
      );
    });

    it('rejects out-of-range single selections with a precise path', async () => {
      await expectPathError(
        baseSubmission({
          answers: [{ kind: 'single', selectedIndex: 2 }],
          correctAnswers: 0,
          score: 0,
        }),
        'answers.0.selectedIndex',
        'Single-choice selectedIndex must be null or an integer within options range',
      );

      await expectPathError(
        baseSubmission({
          answers: [{ kind: 'single', selectedIndex: 0.5 }],
          correctAnswers: 0,
          score: 0,
        }),
        'answers.0.selectedIndex',
        'Single-choice selectedIndex must be null or an integer within options range',
      );
    });

    it('rejects out-of-range and duplicate multiple selections with a precise path', async () => {
      await expectPathError(
        baseSubmission({
          quizSnapshot: {
            integrity: 'complete',
            title: 'Quiz',
            slug: 'quiz',
            questions: [
              {
                question: 'Pick all',
                options: ['A', 'B', 'C'],
                type: 'multiple',
                correctIndexes: [0, 1],
              },
            ],
          },
          answers: [{ kind: 'multiple', selectedIndexes: [0, 3] }],
          correctAnswers: 0,
          score: 0,
        }),
        'answers.0.selectedIndexes',
        'Multiple-choice selectedIndexes must be unique integers within options range',
      );

      await expectPathError(
        baseSubmission({
          quizSnapshot: {
            integrity: 'complete',
            title: 'Quiz',
            slug: 'quiz',
            questions: [
              {
                question: 'Pick all',
                options: ['A', 'B', 'C'],
                type: 'multiple',
                correctIndexes: [0, 1],
              },
            ],
          },
          answers: [{ kind: 'multiple', selectedIndexes: [1, 1] }],
          correctAnswers: 0,
          score: 0,
        }),
        'answers.0.selectedIndexes',
        'Multiple-choice selectedIndexes must be unique integers within options range',
      );
    });
  });

  describe('model registration', () => {
    it('exports a mongoose model named Attempt', () => {
      expect(Attempt.modelName).toBe('Attempt');
      expect(typeof Attempt.validate).toBe('function');
    });
  });
});
