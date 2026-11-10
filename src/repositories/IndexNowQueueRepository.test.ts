import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const lean = vi.fn();
  const limit = vi.fn(() => ({ lean }));
  const sort = vi.fn(() => ({ limit }));
  return {
    connectDB: vi.fn(),
    bulkWrite: vi.fn(),
    find: vi.fn(() => ({ sort })),
    sort,
    limit,
    lean,
    deleteMany: vi.fn(),
    updateOne: vi.fn(),
  };
});

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/IndexNowQueue', () => ({
  INDEXNOW_THROTTLE_ID: 'global',
  IndexNowPendingUrl: {
    bulkWrite: mocks.bulkWrite,
    find: mocks.find,
    deleteMany: mocks.deleteMany,
  },
  IndexNowThrottle: { updateOne: mocks.updateOne },
}));

import { IndexNowQueueRepository } from '@/repositories/IndexNowQueueRepository';

const QUIZ_URL = 'https://www.rinkuzu.app/vi/quiz/fake-biology-quiz';
const HUB_URL = 'https://www.rinkuzu.app/vi/explore/fake-topic';
const NOW = new Date('2026-11-10T12:00:00.000Z');

describe('IndexNowQueueRepository (RIN-1500)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts each URL once, keeping the first queuedAt', async () => {
    await new IndexNowQueueRepository().enqueue([QUIZ_URL, HUB_URL], NOW);
    expect(mocks.bulkWrite).toHaveBeenCalledWith(
      [QUIZ_URL, HUB_URL].map((url) => ({
        updateOne: {
          filter: { url },
          update: { $setOnInsert: { url, queuedAt: NOW } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  });

  it('skips the database for an empty enqueue or removal', async () => {
    const repository = new IndexNowQueueRepository();
    await repository.enqueue([], NOW);
    await repository.removePending([]);
    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('lists pending URLs oldest first', async () => {
    mocks.lean.mockResolvedValue([{ url: QUIZ_URL }, { url: HUB_URL }]);
    await expect(new IndexNowQueueRepository().listPending(100)).resolves.toEqual([
      QUIZ_URL,
      HUB_URL,
    ]);
    expect(mocks.find).toHaveBeenCalledWith({}, { url: 1, _id: 0 });
    expect(mocks.sort).toHaveBeenCalledWith({ queuedAt: 1 });
    expect(mocks.limit).toHaveBeenCalledWith(100);
  });

  it('claims the slot only when the last send is older than the interval', async () => {
    mocks.updateOne.mockResolvedValue({ acknowledged: true });
    await expect(new IndexNowQueueRepository().claimSendSlot(NOW, 60_000)).resolves.toBe(true);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: 'global', lastSentAt: { $lte: new Date('2026-11-10T11:59:00.000Z') } },
      { $set: { lastSentAt: NOW } },
      { upsert: true },
    );
  });

  it('reports a held slot when the upsert collides on _id', async () => {
    mocks.updateOne.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));
    await expect(new IndexNowQueueRepository().claimSendSlot(NOW, 60_000)).resolves.toBe(false);
  });

  it('rethrows other database errors', async () => {
    mocks.updateOne.mockRejectedValue(new Error('network'));
    await expect(new IndexNowQueueRepository().claimSendSlot(NOW, 60_000)).rejects.toThrow(
      'network',
    );
  });

  it('stores the last send result on the throttle document (RIN-1511)', async () => {
    mocks.updateOne.mockResolvedValue({ acknowledged: true });
    const record = { outcome: 'sent' as const, status: 202, attempt: 1, urlCount: 3, at: NOW };
    await new IndexNowQueueRepository().recordResult(record);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: 'global' },
      { $set: { lastResult: record } },
    );
  });

  it('removes the sent URLs', async () => {
    await new IndexNowQueueRepository().removePending([QUIZ_URL]);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ url: { $in: [QUIZ_URL] } });
  });
});
