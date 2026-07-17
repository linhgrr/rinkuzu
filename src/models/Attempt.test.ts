import { describe, expect, it } from 'vitest';
import Attempt from '@/models/Attempt';

const submission = {
  idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
  submissionDigest: 'a'.repeat(64),
  quiz: '507f191e810c19729de860ea',
  quizSnapshot: {
    integrity: 'complete',
    title: 'Quiz',
    slug: 'quiz',
    questions: [
      {
        question: 'Question?',
        options: ['A', 'B'],
        type: 'single',
        correctIndex: 0,
      },
    ],
  },
  score: 100,
  correctAnswers: 1,
  totalQuestions: 1,
  answers: [{ kind: 'single', selectedIndex: 0 }],
};

describe('Attempt model identity', () => {
  it('casts a registered user ID to ObjectId', async () => {
    const attempt = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
    });

    await expect(attempt.validate()).resolves.toBeUndefined();
    expect(attempt.user?.constructor.name).toBe('ObjectId');
    expect(attempt.guestEmail).toBeUndefined();
  });

  it('accepts a guest email without a user ID', async () => {
    const attempt = new Attempt({
      ...submission,
      guestEmail: 'Guest@Example.com',
    });

    await expect(attempt.validate()).resolves.toBeUndefined();
    expect(attempt.guestEmail).toBe('guest@example.com');
    expect(attempt.user).toBeUndefined();
  });

  it('rejects missing or conflicting identities', async () => {
    const missingIdentity = new Attempt(submission);
    const conflictingIdentity = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      guestEmail: 'guest@example.com',
    });

    await expect(missingIdentity.validate()).rejects.toThrow(
      'Exactly one attempt identity is required',
    );
    await expect(conflictingIdentity.validate()).rejects.toThrow(
      'Exactly one attempt identity is required',
    );
  });

  it('requires a valid immutable quiz snapshot for new attempts', async () => {
    const missingSnapshot = new Attempt({
      ...submission,
      quizSnapshot: undefined,
      user: '507f191e810c19729de860eb',
    });
    const falseCompleteSnapshot = new Attempt({
      ...submission,
      quizSnapshot: { integrity: 'complete', title: 'Quiz', slug: 'quiz', questions: [] },
      user: '507f191e810c19729de860eb',
    });

    await expect(missingSnapshot.validate()).rejects.toThrow('Quiz snapshot is required');
    await expect(falseCompleteSnapshot.validate()).rejects.toThrow(
      'Quiz snapshots require at least one question',
    );
  });

  it('enforces a complete and internally consistent submission contract', async () => {
    const inconsistent = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      answers: [],
      correctAnswers: 0,
      score: 0,
    });

    await expect(inconsistent.validate()).rejects.toThrow(
      'Answer count must match total questions',
    );
    await expect(
      new Attempt({
        ...submission,
        user: '507f191e810c19729de860eb',
        score: 0,
      }).validate(),
    ).rejects.toThrow('Score must match the correct answer count');
  });

  it('accepts image-only options but rejects options without text or an image', async () => {
    const imageOnly = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      quizSnapshot: {
        ...submission.quizSnapshot,
        questions: [
          {
            question: 'Choose an image',
            options: ['', ''],
            optionImages: ['https://example.com/a.png', 'https://example.com/b.png'],
            type: 'single',
            correctIndex: 0,
          },
        ],
      },
    });
    const contentlessOption = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      quizSnapshot: {
        ...submission.quizSnapshot,
        questions: [
          {
            question: 'Invalid option',
            options: ['', 'B'],
            type: 'single',
            correctIndex: 0,
          },
        ],
      },
    });

    await expect(imageOnly.validate()).resolves.toBeUndefined();
    await expect(contentlessOption.validate()).rejects.toThrow('Option requires text or an image');
  });

  it('enforces the discriminated correct-answer contract in persistence', async () => {
    const fractionalSingle = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      quizSnapshot: {
        ...submission.quizSnapshot,
        questions: [
          {
            question: 'Question',
            options: ['A', 'B'],
            type: 'single',
            correctIndex: 0.5,
          },
        ],
      },
    });
    const duplicateMultiple = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      quizSnapshot: {
        ...submission.quizSnapshot,
        questions: [
          {
            question: 'Question',
            options: ['A', 'B'],
            type: 'multiple',
            correctIndexes: [0, 0],
          },
        ],
      },
      answers: [{ kind: 'multiple', selectedIndexes: [0] }],
      correctAnswers: 0,
      score: 0,
    });

    await expect(fractionalSingle.validate()).rejects.toThrow(
      'Single choice questions must have a valid correct index',
    );
    await expect(duplicateMultiple.validate()).rejects.toThrow(
      'Multiple choice questions must have at least one valid correct index',
    );
  });

  it('accepts valid single, multiple, and unanswered selections', async () => {
    const singleCorrect = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
    });
    await expect(singleCorrect.validate()).resolves.toBeUndefined();

    const multipleCorrect = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      quizSnapshot: {
        ...submission.quizSnapshot,
        questions: [
          {
            question: 'Pick all',
            options: ['A', 'B', 'C'],
            type: 'multiple',
            correctIndexes: [0, 2],
          },
        ],
      },
      answers: [{ kind: 'multiple', selectedIndexes: [2, 0] }],
      correctAnswers: 1,
      score: 100,
    });
    await expect(multipleCorrect.validate()).resolves.toBeUndefined();

    const unanswered = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      answers: [{ kind: 'single', selectedIndex: null }],
      correctAnswers: 0,
      score: 0,
    });
    await expect(unanswered.validate()).resolves.toBeUndefined();
  });

  it('rejects forged score or correctAnswers when the selected answer is wrong', async () => {
    await expect(
      new Attempt({
        ...submission,
        user: '507f191e810c19729de860eb',
        answers: [{ kind: 'single', selectedIndex: 1 }],
        correctAnswers: 1,
        score: 100,
      }).validate(),
    ).rejects.toThrow('Correct answer count must match evaluated answers');
  });

  it('rejects fractional correctAnswers', async () => {
    await expect(
      new Attempt({
        ...submission,
        user: '507f191e810c19729de860eb',
        correctAnswers: 0.5,
        score: 50,
      }).validate(),
    ).rejects.toThrow('Correct answer count must be an integer');
  });

  it('rejects fractional totalQuestions', async () => {
    await expect(
      new Attempt({
        ...submission,
        user: '507f191e810c19729de860eb',
        totalQuestions: 1.5,
      }).validate(),
    ).rejects.toThrow('Total questions must be an integer');
  });
});
