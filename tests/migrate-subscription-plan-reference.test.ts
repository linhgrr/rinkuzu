import { describe, expect, it } from 'vitest';
import { classifyPlanReference } from '@/../scripts/migrate-subscription-plan-reference.mjs';

const plans = new Map([['plan-plus', { id: 'plan-plus', name: 'Plus' }]]);

describe('subscription plan-reference migration', () => {
  it('converts a legacy type into the canonical plan snapshot', () => {
    expect(classifyPlanReference({ type: 'plan-plus' }, plans, 'subscription.sub-1')).toEqual({
      kind: 'migrate',
      planId: 'plan-plus',
      planName: 'Plus',
    });
  });

  it('is idempotent for canonical references', () => {
    expect(
      classifyPlanReference(
        { planId: 'plan-plus', planName: 'Plus at purchase time' },
        plans,
        'subscription.sub-1',
      ),
    ).toEqual({
      kind: 'clean',
      planId: 'plan-plus',
      planName: 'Plus at purchase time',
    });
  });

  it('fails closed for dangling or conflicting references', () => {
    expect(() => classifyPlanReference({ type: 'missing' }, plans, 'subscription.sub-1')).toThrow(
      'references missing plan',
    );
    expect(() =>
      classifyPlanReference(
        { type: 'plan-plus', planId: 'another-plan' },
        plans,
        'subscription.sub-1',
      ),
    ).toThrow('conflicting type and planId');
  });
});
