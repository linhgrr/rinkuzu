import { describe, expect, it } from 'vitest';

import { validateOrphanedQuizDataDeletion } from '../../scripts/delete-orphaned-quiz-data.mjs';

function plan(total = 2) {
  return {
    total,
    planSha: 'approved-sha',
  };
}

describe('orphaned quiz data deletion guard', () => {
  it('requires explicit apply and an exact approved plan', () => {
    expect(() =>
      validateOrphanedQuizDataDeletion({
        apply: false,
        approvedPlanSha: 'approved-sha',
        maxDelete: 100,
        plan: plan(),
      }),
    ).toThrow('Deletion requires --apply');

    expect(() =>
      validateOrphanedQuizDataDeletion({
        apply: true,
        approvedPlanSha: undefined,
        maxDelete: 100,
        plan: plan(),
      }),
    ).toThrow('Apply requires --approve-plan=approved-sha');

    expect(() =>
      validateOrphanedQuizDataDeletion({
        apply: true,
        approvedPlanSha: 'stale-sha',
        maxDelete: 100,
        plan: plan(),
      }),
    ).toThrow('Approved plan SHA does not match');
  });

  it('enforces the delete ceiling and validates it even for an empty plan', () => {
    expect(() =>
      validateOrphanedQuizDataDeletion({
        apply: true,
        approvedPlanSha: 'approved-sha',
        maxDelete: 1,
        plan: plan(),
      }),
    ).toThrow('above the --max-delete limit');

    expect(() =>
      validateOrphanedQuizDataDeletion({
        apply: true,
        approvedPlanSha: undefined,
        maxDelete: 0,
        plan: plan(0),
      }),
    ).toThrow('--max-delete must be a positive safe integer');
  });
});
