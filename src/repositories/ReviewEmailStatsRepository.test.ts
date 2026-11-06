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

describe('ReviewEmailStatsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.excludedUserIds.mockResolvedValue(EXCLUDED);
    mocks.outboxAggregate.mockResolvedValue([{ _id: FROM, sent: 3, opened: 1 }]);
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
        kind: 'review_reminder',
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
      sends: [{ weekStart: FROM, sent: 3, opened: 1 }],
      consents: [{ weekStart: FROM, optIns: 2, unsubscribed: 1 }],
      opensTracked: false,
    });
  });

  it('reports opens as tracked once any open webhook is on record', async () => {
    mocks.webhookExists.mockResolvedValue({ _id: new Types.ObjectId() });

    const counts = await new ReviewEmailStatsRepository().getWeeklyCounts(FROM, TO, []);

    expect(mocks.webhookExists).toHaveBeenCalledWith({ eventType: 'email.opened' });
    expect(counts.opensTracked).toBe(true);
  });
});
