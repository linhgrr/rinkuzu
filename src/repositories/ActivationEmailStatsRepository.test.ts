import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  excludedUserIds: vi.fn(),
  outboxAggregate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/Communication', () => ({
  EmailOutbox: { aggregate: mocks.outboxAggregate },
}));
vi.mock('@/models/Attempt', () => ({ default: { collection: { name: 'attempts' } } }));
vi.mock('@/repositories/AdminStatsRepository', () => ({
  AdminStatsRepository: { excludedUserIds: mocks.excludedUserIds },
}));

import { ActivationEmailStatsRepository } from '@/repositories/ActivationEmailStatsRepository';
import { activationEmailPipeline } from '@/repositories/pipelines/activation-email';

const DAY = 86_400_000;
const FROM = new Date('2026-10-26T00:00:00.000Z');
const TO = new Date('2026-11-09T00:00:00.000Z');
const EXCLUDED = [new Types.ObjectId()];
const LEARNER = '64b0000000000000000000b1'; // fake id

type Stage = Record<string, Record<string, unknown>>;

function stage(pipeline: unknown[], name: string): Record<string, unknown> {
  const found = (pipeline as Stage[]).find((entry) => name in entry);
  if (!found) throw new Error(`no ${name} stage`);
  return found[name] as Record<string, unknown>;
}

describe('ActivationEmailStatsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.excludedUserIds.mockResolvedValue(EXCLUDED);
    mocks.outboxAggregate.mockResolvedValue([
      { _id: { weekStart: FROM, trigger: '24h' }, sent: 3, clicked: 1, activatedWithin7d: 2 },
      { _id: { weekStart: FROM, trigger: 'backfill' }, sent: 1, clicked: 0, activatedWithin7d: 0 },
    ]);
  });

  it('counts completed activation nudges in the window, never an excluded account', async () => {
    const rows = await new ActivationEmailStatsRepository().getWeeklySends(FROM, TO, []);

    expect(mocks.excludedUserIds).toHaveBeenCalledWith();
    const pipeline = mocks.outboxAggregate.mock.calls[0]?.[0] as unknown[];
    expect(stage(pipeline, '$match')).toEqual({
      status: 'completed',
      availableAt: { $gte: FROM, $lt: TO },
      kind: 'activation_nudge',
      userId: { $type: 'objectId', $nin: EXCLUDED },
    });
    expect(rows).toEqual([
      { weekStart: FROM, trigger: '24h', sent: 3, clicked: 1, activatedWithin7d: 2 },
      { weekStart: FROM, trigger: 'backfill', sent: 1, clicked: 0, activatedWithin7d: 0 },
    ]);
  });

  it('injects only adaptive completions that can fall in a send window', async () => {
    const inside = new Date(TO.getTime() + 6 * DAY);
    await new ActivationEmailStatsRepository().getWeeklySends(FROM, TO, [
      {
        userId: LEARNER,
        firstCompletionAt: null,
        completions: [new Date(FROM.getTime() - 1), inside, new Date(TO.getTime() + 7 * DAY)],
        succeededUploads: [],
      },
      {
        userId: 'not-an-object-id',
        firstCompletionAt: null,
        completions: [inside],
        succeededUploads: [],
      },
    ]);

    const pipeline = mocks.outboxAggregate.mock.calls[0]?.[0] as unknown[];
    const literal = JSON.stringify(stage(pipeline, '$group'));
    expect(literal).toContain(inside.toISOString());
    expect(literal).toContain(LEARNER);
    expect(literal).not.toContain('not-an-object-id');
    expect(literal).not.toContain(new Date(FROM.getTime() - 1).toISOString());
    expect(literal).not.toContain(new Date(TO.getTime() + 7 * DAY).toISOString());
  });
});

describe('activationEmailPipeline', () => {
  const pipeline = activationEmailPipeline({
    from: FROM,
    to: TO,
    excludedUserIds: EXCLUDED,
    attemptsCollection: 'attempts',
    adaptive: [],
  });

  it('looks up one attempt per send in [sentAt, sentAt + 7 days) by user', () => {
    const lookup = stage(pipeline, '$lookup');
    expect(lookup).toMatchObject({ from: 'attempts', localField: 'uid', foreignField: 'user' });
    const inner = lookup.pipeline as unknown[];
    expect(JSON.stringify(inner)).toContain(String(7 * DAY));
    expect(inner).toContainEqual({ $limit: 1 });
  });

  it('reads clickedAt when present and buckets by send week and trigger', () => {
    expect(stage(pipeline, '$project')).toMatchObject({
      sentAt: '$availableAt',
      trigger: { $ifNull: ['$trigger', '24h'] },
      clicked: { $ne: [{ $ifNull: ['$clickedAt', null] }, null] },
    });
    expect(stage(pipeline, '$group')._id).toMatchObject({ trigger: '$trigger' });
  });
});
