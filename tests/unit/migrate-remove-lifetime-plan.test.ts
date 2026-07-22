import { describe, expect, it } from 'vitest';
import {
  buildLifetimeRemovalPlan,
  LIFETIME_PLAN_ID,
  MONTHLY_PLAN_ID,
  validateLifetimeRemovalPlan,
} from '../../scripts/migrate-remove-lifetime-plan.mjs';

const monthlyPlan = {
  _id: MONTHLY_PLAN_ID,
  name: 'Premium 1 tháng',
  price: 39_000,
  duration: 'P1M',
  isActive: true,
  features: [
    'Tạo quiz riêng tư',
    'Ask Rin-chan: 150 lần/ngày',
    'Trích xuất quiz từ PDF: 50 lần/tháng',
    'Tạo lộ trình thích ứng: 12 lần/tháng',
    'Tạo bài tập thích ứng: 500 lần/ngày',
    'PDF lộ trình tối đa 100 trang',
  ],
};

function buildPlan(subscriptionOverrides: Record<string, unknown> = {}) {
  return buildLifetimeRemovalPlan({
    lifetimePlan: { _id: LIFETIME_PLAN_ID, duration: 'PT0S' },
    monthlyPlan,
    subscriptions: [
      {
        _id: 'sub-1',
        type: LIFETIME_PLAN_ID,
        status: 'completed',
        payosOrderId: 'admin_grant-1',
        payosTransactionId: 'admin_grant-1',
        ...subscriptionOverrides,
      },
    ],
    users: [{ _id: 'user-1', subscription: { type: LIFETIME_PLAN_ID } }],
  });
}

describe('remove lifetime plan migration', () => {
  it('allows explicit admin grants and produces an order-independent plan SHA', () => {
    const plan = buildPlan();
    const reversed = buildLifetimeRemovalPlan({
      lifetimePlan: { _id: LIFETIME_PLAN_ID, duration: 'PT0S' },
      monthlyPlan,
      subscriptions: [...plan.subscriptions].reverse(),
      users: [...plan.users].reverse(),
    });

    expect(plan.realCompletedPurchases).toEqual([]);
    expect(reversed.planSha).toBe(plan.planSha);
    expect(() => validateLifetimeRemovalPlan(plan, 20)).not.toThrow();
  });

  it('fails closed for a completed PayOS lifetime purchase', () => {
    const plan = buildPlan({
      payosOrderId: '1783443416767172',
      payosTransactionId: 'payos-transaction-1',
    });

    expect(() => validateLifetimeRemovalPlan(plan, 20)).toThrow(
      'completed non-admin lifetime purchase',
    );
  });

  it('fails closed when the lifetime id points to another duration', () => {
    const plan = buildLifetimeRemovalPlan({
      lifetimePlan: { _id: LIFETIME_PLAN_ID, duration: 'P1M' },
      monthlyPlan,
      subscriptions: [],
      users: [],
    });

    expect(() => validateLifetimeRemovalPlan(plan, 20)).toThrow('non-lifetime duration');
  });

  it('enforces the document safety cap', () => {
    expect(() => validateLifetimeRemovalPlan(buildPlan(), 2)).toThrow('exceeds --max-documents=2');
  });
});
