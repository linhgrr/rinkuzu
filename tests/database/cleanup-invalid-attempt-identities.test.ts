import { describe, expect, it } from 'vitest';

import {
  createAttemptIdentityPlanSha,
  validateAttemptIdentityCleanup,
} from '../../scripts/cleanup-invalid-attempt-identities.mjs';

function plan(total = 2) {
  return {
    total,
    planSha: 'approved-sha',
  };
}

describe('invalid attempt identity cleanup guard', () => {
  it('creates a stable plan fingerprint regardless of query order', () => {
    const first = createAttemptIdentityPlanSha({
      unattributedIds: ['b', 'a'],
      danglingUserIds: ['d', 'c'],
    });
    const second = createAttemptIdentityPlanSha({
      unattributedIds: ['a', 'b'],
      danglingUserIds: ['c', 'd'],
    });

    expect(first).toBe(second);
  });

  it('requires an exact approved plan before deleting rows', () => {
    expect(() =>
      validateAttemptIdentityCleanup({
        apply: true,
        approvedPlanSha: undefined,
        maxDelete: 100,
        plan: plan(),
      }),
    ).toThrow('Apply requires --approve-plan=approved-sha');

    expect(() =>
      validateAttemptIdentityCleanup({
        apply: true,
        approvedPlanSha: 'stale-sha',
        maxDelete: 100,
        plan: plan(),
      }),
    ).toThrow('Approved plan SHA does not match');
  });

  it('enforces the delete ceiling but permits an idempotent empty apply', () => {
    expect(() =>
      validateAttemptIdentityCleanup({
        apply: true,
        approvedPlanSha: 'approved-sha',
        maxDelete: 1,
        plan: plan(),
      }),
    ).toThrow('above the --max-delete limit');

    expect(() =>
      validateAttemptIdentityCleanup({
        apply: true,
        approvedPlanSha: undefined,
        maxDelete: 100,
        plan: plan(0),
      }),
    ).not.toThrow();
  });
});
