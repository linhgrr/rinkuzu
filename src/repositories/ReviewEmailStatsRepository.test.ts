import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  excludedUserIds: vi.fn(),
  outboxAggregate: vi.fn(),
  consentAggregate: vi.fn(),
  webhookExists: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/Communication', () => ({
  EmailOutbox: { aggregate: mocks.outboxAggregate },
  MarketingConsentEvent: { aggregate: mocks.consentAggregate },
  WebhookEvent: { exists: mocks.webhookExists },
}));
vi.mock('@/repositories/AdminStatsRepository', () => ({
  AdminStatsRepository: { excludedUserIds: mocks.excludedUserIds },
}));

import { ReviewEmailStatsRepository } from '@/repositories/ReviewEmailStatsRepository';

const FROM = new Date('2026-10-26T00:00:00.000Z');
const TO = new Date('2026-11-09T00:00:00.000Z');
const EXCLUDED = [new Types.ObjectId()];
const QA = ['qa@fake.test'];

/** The few aggregation operators the `$cond` uses, evaluated against one event. */
function evaluate(expression: unknown, event: Record<string, unknown>): unknown {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    return event[expression.slice(1)];
  }
  if (expression === null || typeof expression !== 'object') return expression;
  const [operator, raw] = Object.entries(expression)[0] ?? [];
  const args = (raw as unknown[]).map((arg) => evaluate(arg, event));
  if (operator === '$and') return args.every(Boolean);
  if (operator === '$or') return args.some(Boolean);
  if (operator === '$eq') return args[0] === args[1];
  if (operator === '$ne') return args[0] !== args[1];
  if (operator === '$ifNull') return args[0] ?? args[1];
  throw new Error(`unsupported operator ${operator}`);
}

describe('ReviewEmailStatsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.excludedUserIds.mockResolvedValue(EXCLUDED);
    mocks.outboxAggregate.mockResolvedValue([
      { _id: FROM, sent: 3, opened: 1, sentD5: 2, openedD5: 1 },
    ]);
    mocks.consentAggregate.mockResolvedValue([{ _id: FROM, optIns: 2, unsubscribed: 1 }]);
    mocks.webhookExists.mockResolvedValue(null);
  });

  it('counts sent review emails only, without excluded accounts or QA recipients', async () => {
    const counts = await new ReviewEmailStatsRepository().getWeeklyCounts(FROM, TO, QA);

    expect(mocks.excludedUserIds).toHaveBeenCalledWith(QA);
    const [outboxPipeline] = mocks.outboxAggregate.mock.calls[0] ?? [];
    expect(outboxPipeline[0]).toEqual({
      $match: {
        status: 'completed',
        availableAt: { $gte: FROM, $lt: TO },
        kind: { $in: ['review_reminder', 'review_reminder_d5'] },
        userId: { $nin: EXCLUDED },
        to: { $nin: QA },
      },
    });
    const [consentPipeline] = mocks.consentAggregate.mock.calls[0] ?? [];
    expect(consentPipeline[0]).toEqual({
      $match: {
        createdAt: { $gte: FROM, $lt: TO },
        topic: 'study_reminders',
        userId: { $nin: EXCLUDED },
      },
    });
    expect(counts).toEqual({
      sends: [{ weekStart: FROM, sent: 3, opened: 1, sentD5: 2, openedD5: 1 }],
      consents: [{ weekStart: FROM, optIns: 2, unsubscribed: 1 }],
      opensTracked: false,
    });
  });

  it('splits sends and opens into the day-2 and day-5 emails (RIN-1304)', async () => {
    await new ReviewEmailStatsRepository().getWeeklyCounts(FROM, TO, QA);

    const [outboxPipeline] = mocks.outboxAggregate.mock.calls[0] ?? [];
    const group = outboxPipeline[1].$group;
    const count = (field: string, row: Record<string, unknown>) =>
      evaluate(group[field].$sum.$cond[0], row) === true ? 1 : 0;
    const rows = [
      { kind: 'review_reminder', openedAt: new Date() },
      { kind: 'review_reminder', openedAt: null },
      { kind: 'review_reminder_d5', openedAt: new Date() },
      { kind: 'review_reminder_d5' },
      { kind: 'review_reminder_d5', openedAt: null },
    ];
    const total = (field: string) => rows.reduce((sum, row) => sum + count(field, row), 0);
    expect({
      sent: total('sent'),
      opened: total('opened'),
      sentD5: total('sentD5'),
      openedD5: total('openedD5'),
    }).toEqual({ sent: 2, opened: 1, sentD5: 3, openedD5: 1 });
  });

  it('counts review-email unsubscribes only, not activation-nudge ones (RIN-1044)', async () => {
    await new ReviewEmailStatsRepository().getWeeklyCounts(FROM, TO, QA);

    const [consentPipeline] = mocks.consentAggregate.mock.calls[0] ?? [];
    const condition = consentPipeline[1].$group.unsubscribed.$sum.$cond[0];
    const counted = (event: Record<string, unknown>) => evaluate(condition, event) === true;
    const unsubscribe = { action: 'opt_out', source: 'unsubscribe' };

    expect(counted(unsubscribe)).toBe(true); // review link, and every event before RIN-1044
    expect(counted({ ...unsubscribe, campaign: null })).toBe(true);
    expect(counted({ ...unsubscribe, campaign: 'activation_nudge' })).toBe(false);
    expect(counted({ action: 'opt_out', source: 'result_page_review' })).toBe(false);
  });

  it('counts opt-ins from both review prompts, quiz and adaptive (RIN-1364)', async () => {
    await new ReviewEmailStatsRepository().getWeeklyCounts(FROM, TO, QA);

    const [consentPipeline] = mocks.consentAggregate.mock.calls[0] ?? [];
    const condition = consentPipeline[1].$group.optIns.$sum.$cond[0];
    const counted = (event: Record<string, unknown>) => evaluate(condition, event) === true;

    expect(counted({ action: 'opt_in', source: 'result_page_review' })).toBe(true);
    expect(counted({ action: 'opt_in', source: 'adaptive_end_review' })).toBe(true);
    expect(counted({ action: 'opt_in', source: 'settings' })).toBe(false);
    expect(counted({ action: 'opt_out', source: 'adaptive_end_review' })).toBe(false);
  });

  it('reports opens as tracked once any open webhook is on record', async () => {
    mocks.webhookExists.mockResolvedValue({ _id: new Types.ObjectId() });

    const counts = await new ReviewEmailStatsRepository().getWeeklyCounts(FROM, TO, []);

    expect(mocks.webhookExists).toHaveBeenCalledWith({ eventType: 'email.opened' });
    expect(counts.opensTracked).toBe(true);
  });
});
