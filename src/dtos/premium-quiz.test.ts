import { describe, expect, it } from 'vitest';
import {
  decidePremiumSubmissionRequestSchema,
  premiumSessionSubmitRequestSchema,
} from '@/dtos/premium-quiz';

describe('Premium submission decision DTO', () => {
  it.each([1, 2, 3, 4, 5])('accepts an approval reward of %s credits', (credits) => {
    expect(
      decidePremiumSubmissionRequestSchema.safeParse({ decision: 'approve', credits }).success,
    ).toBe(true);
  });

  it('requires the admin to choose 1–5 credits even when the repository will duplicate-lock it', () => {
    const result = decidePremiumSubmissionRequestSchema.safeParse({
      decision: 'approve',
      credits: 0,
      overrideReason: 'Duplicate document reward is locked by the repository',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['credits'] })]),
    );
  });

  it.each(['request_changes', 'reject'] as const)(
    'forbids credits for a %s decision',
    (decision) => {
      expect(decidePremiumSubmissionRequestSchema.safeParse({ decision, credits: 2 }).success).toBe(
        false,
      );
      expect(decidePremiumSubmissionRequestSchema.safeParse({ decision, credits: 0 }).success).toBe(
        true,
      );
    },
  );
});

describe('Premium session submit DTO', () => {
  it('rejects a quick round: quick mode exists only on the normal submit path (RIN-936)', () => {
    const idempotencyKey = '018f7494-8bd8-7b8a-a387-3bc5a14f22a1';
    expect(premiumSessionSubmitRequestSchema.safeParse({ idempotencyKey }).success).toBe(true);
    expect(
      premiumSessionSubmitRequestSchema.safeParse({
        idempotencyKey,
        mode: 'quick',
        questionIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      }).success,
    ).toBe(false);
  });
});
