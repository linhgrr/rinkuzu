import { describe, expect, it } from 'vitest';
import { decidePremiumSubmissionRequestSchema } from '@/dtos/premium-quiz';

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
