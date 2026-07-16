import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import {
  buildAttemptQuizSnapshotPlan,
  validateAttemptQuizSnapshotMigration,
} from '../../scripts/migrate-attempt-quiz-snapshots.mjs';

const quizId = new ObjectId('65a000000000000000000001');
const attemptTime = new Date('2026-07-01T00:00:00.000Z');

function question(id: string, overrides = {}) {
  return {
    _id: new ObjectId(id),
    question: 'Question?',
    options: ['A', 'B'],
    type: 'single',
    correctIndex: 0,
    ...overrides,
  };
}

function quiz(overrides = {}) {
  return {
    _id: quizId,
    title: 'Quiz',
    slug: 'quiz',
    questions: [question('65a000000000000000000010')],
    ...overrides,
  };
}

function attempt(id: string, overrides = {}) {
  return {
    _id: new ObjectId(id),
    quiz: quizId,
    answers: [{ kind: 'single', selectedIndex: 0 }],
    score: 0,
    takenAt: attemptTime,
    ...overrides,
  };
}

describe('attempt quiz snapshot migration', () => {
  it('creates exact snapshots, normalizes derived fields, and deletes unrecoverable attempts', () => {
    const rows = {
      attemptRows: [
        attempt('65a000000000000000000101'),
        attempt('65a000000000000000000102', {
          answers: [
            { kind: 'single', selectedIndex: 0 },
            { kind: 'single', selectedIndex: 1 },
          ],
        }),
        attempt('65a000000000000000000103', {
          quiz: new ObjectId('65a000000000000000000099'),
        }),
      ],
      quizRows: [quiz()],
    };

    const first = buildAttemptQuizSnapshotPlan(rows);
    const second = buildAttemptQuizSnapshotPlan({
      attemptRows: [...rows.attemptRows].reverse(),
      quizRows: [...rows.quizRows].reverse(),
    });

    expect(first.planSha).toBe(second.planSha);
    expect(first.summary).toEqual({
      snapshotsToCreateOrNormalize: 1,
      attemptsToDelete: 2,
      totalDocuments: 3,
      normalizedScores: 1,
      normalizedTotalQuestions: 1,
      deletionReasons: {
        answerQuestionCountMismatch: 1,
        missingQuiz: 1,
      },
    });
    expect(first.updateActions[0]?.set).toMatchObject({
      answers: [{ kind: 'single', selectedIndex: 0 }],
      score: 100,
      totalQuestions: 1,
      quizSnapshot: { integrity: 'complete', title: 'Quiz', slug: 'quiz' },
    });
  });

  it('deletes attempts whose current quiz questions were recreated later', () => {
    const plan = buildAttemptQuizSnapshotPlan({
      attemptRows: [attempt('65a000000000000000000104')],
      quizRows: [
        quiz({
          questions: [question('70a000000000000000000010')],
        }),
      ],
    });

    expect(plan.summary).toMatchObject({
      snapshotsToCreateOrNormalize: 0,
      attemptsToDelete: 1,
      deletionReasons: { quizQuestionsChangedAfterAttempt: 1 },
    });
  });

  it('deletes non-canonical legacy answer payloads instead of guessing', () => {
    const plan = buildAttemptQuizSnapshotPlan({
      attemptRows: [attempt('65a000000000000000000107', { answers: [0] })],
      quizRows: [quiz()],
    });

    expect(plan.summary).toMatchObject({
      snapshotsToCreateOrNormalize: 0,
      attemptsToDelete: 1,
      deletionReasons: { malformedAnswers: 1 },
    });
  });

  it('preserves image-only options when every blank option has an image', () => {
    const plan = buildAttemptQuizSnapshotPlan({
      attemptRows: [attempt('65a000000000000000000109')],
      quizRows: [
        quiz({
          questions: [
            question('65a000000000000000000010', {
              options: ['', ''],
              optionImages: ['https://example.com/a.png', 'https://example.com/b.png'],
            }),
          ],
        }),
      ],
    });

    expect(plan.summary).toMatchObject({
      snapshotsToCreateOrNormalize: 1,
      attemptsToDelete: 0,
    });
  });

  it('is idempotent for canonical embedded snapshots', () => {
    const snapshot = {
      integrity: 'complete',
      title: 'Quiz',
      slug: 'quiz',
      questions: [question('65a000000000000000000010')],
    };
    const plan = buildAttemptQuizSnapshotPlan({
      attemptRows: [
        attempt('65a000000000000000000105', {
          quizSnapshot: snapshot,
          answers: [{ kind: 'single', selectedIndex: 0 }],
          score: 100,
          totalQuestions: 1,
        }),
      ],
      quizRows: [],
    });

    expect(plan.summary.totalDocuments).toBe(0);
  });

  it('requires exact approval and enforces the document ceiling', () => {
    const plan = buildAttemptQuizSnapshotPlan({
      attemptRows: [
        attempt('65a000000000000000000106'),
        attempt('65a000000000000000000108', {
          quiz: new ObjectId('65a000000000000000000099'),
        }),
      ],
      quizRows: [quiz()],
    });

    expect(() =>
      validateAttemptQuizSnapshotMigration({
        apply: true,
        approvedPlanSha: undefined,
        maxDocuments: 10,
        plan,
      }),
    ).toThrow(`Apply requires --approve-plan=${plan.planSha}`);
    expect(() =>
      validateAttemptQuizSnapshotMigration({
        apply: true,
        approvedPlanSha: 'stale',
        maxDocuments: 10,
        plan,
      }),
    ).toThrow('Approved plan SHA does not match');
    expect(() =>
      validateAttemptQuizSnapshotMigration({
        apply: true,
        approvedPlanSha: plan.planSha,
        maxDocuments: 1,
        plan,
      }),
    ).toThrow('above the --max-documents limit');
  });
});
