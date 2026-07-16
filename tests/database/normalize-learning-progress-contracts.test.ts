import { describe, expect, it } from 'vitest';
import {
  buildLearningProgressNormalizationPlan,
  validateLearningProgressNormalization,
} from '../../scripts/normalize-learning-progress-contracts.mjs';

const activity = { questionsReviewed: 1, xpEarned: 10, correctCount: 1, totalCount: 1 };

function buildRows() {
  const anchor = new Date('2026-07-16T00:30:00.000Z');
  return {
    userProgressRows: [
      {
        _id: 'user-progress-1',
        lastActiveDate: anchor,
        weeklyActivity: Object.fromEntries(
          Array.from({ length: 17 }, (_, index) => {
            const date = new Date(anchor);
            date.setUTCDate(date.getUTCDate() - index);
            return [date.toISOString().slice(0, 10), activity];
          }),
        ),
      },
    ],
    questionProgressRows: [
      {
        _id: 'question-progress-1',
        history: Array.from({ length: 55 }, (_, index) => ({
          date: new Date(Date.UTC(2026, 0, index + 1)),
          rating: 'good',
        })),
      },
    ],
  };
}

describe('learning progress normalization guard', () => {
  it('builds a stable bounded-data plan without mutating source rows', () => {
    const rows = buildRows();
    const first = buildLearningProgressNormalizationPlan(rows);
    const second = buildLearningProgressNormalizationPlan({
      userProgressRows: [...rows.userProgressRows].reverse(),
      questionProgressRows: [...rows.questionProgressRows].reverse(),
    });

    expect(first.planSha).toBe(second.planSha);
    expect(first.summary).toEqual({
      userProgressDocuments: 1,
      questionProgressDocuments: 1,
      totalDocuments: 2,
      missingLastSessionDates: 1,
      missingWeeklyActivity: 0,
      weeklyActivityEntriesRemoved: 3,
      missingReviewHistory: 0,
      reviewHistoryEntriesRemoved: 5,
    });
    expect(Object.keys(first.userActions[0]?.set.weeklyActivity ?? {})).toHaveLength(14);
    expect(first.questionActions[0]?.set.history).toHaveLength(50);
    expect(rows.questionProgressRows[0]?.history).toHaveLength(55);
  });

  it('requires exact approval and enforces the document ceiling', () => {
    const plan = buildLearningProgressNormalizationPlan(buildRows());

    expect(() =>
      validateLearningProgressNormalization({
        apply: true,
        approvedPlanSha: undefined,
        maxDocuments: 100,
        plan,
      }),
    ).toThrow(`Apply requires --approve-plan=${plan.planSha}`);
    expect(() =>
      validateLearningProgressNormalization({
        apply: true,
        approvedPlanSha: 'stale-plan',
        maxDocuments: 100,
        plan,
      }),
    ).toThrow('Approved plan SHA does not match');
    expect(() =>
      validateLearningProgressNormalization({
        apply: true,
        approvedPlanSha: plan.planSha,
        maxDocuments: 1,
        plan,
      }),
    ).toThrow('above the --max-documents limit');
  });

  it('fails closed on malformed embedded data', () => {
    expect(() =>
      buildLearningProgressNormalizationPlan({
        userProgressRows: [
          { _id: 'user-progress-1', lastActiveDate: new Date(), weeklyActivity: [] },
        ],
        questionProgressRows: [],
      }),
    ).toThrow('invalid weeklyActivity data');

    expect(() =>
      buildLearningProgressNormalizationPlan({
        userProgressRows: [],
        questionProgressRows: [{ _id: 'question-progress-1', history: {} }],
      }),
    ).toThrow('non-array history');
  });
});
