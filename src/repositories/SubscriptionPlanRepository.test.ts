import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/Plan', () => ({
  default: {
    find: mocks.find,
    findById: mocks.findById,
    findOne: mocks.findOne,
  },
}));

import { SubscriptionPlanRepository } from '@/repositories/SubscriptionPlanRepository';

const now = new Date('2026-07-01T00:00:00.000Z');
const planRecord = {
  _id: 'premium-p1m',
  name: 'Premium',
  price: 99_000,
  duration: 'P1M',
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

function leanResult(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe('SubscriptionPlanRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
  });

  it('finds and maps a plan by id without fabricating missing records', async () => {
    mocks.findById
      .mockReturnValueOnce(leanResult(planRecord))
      .mockReturnValueOnce(leanResult(null));
    const repository = new SubscriptionPlanRepository();

    await expect(repository.findById(planRecord._id)).resolves.toMatchObject({
      id: planRecord._id,
      name: planRecord.name,
    });
    await expect(repository.findById('missing')).resolves.toBeNull();
    expect(mocks.connectDB).toHaveBeenCalledTimes(2);
  });

  it('requires isActive when finding an active plan', async () => {
    mocks.findOne.mockReturnValue(leanResult(planRecord));
    const repository = new SubscriptionPlanRepository();

    await expect(repository.findActiveById(planRecord._id)).resolves.toMatchObject({
      id: planRecord._id,
      isActive: true,
    });
    expect(mocks.findOne).toHaveBeenCalledWith({
      _id: planRecord._id,
      duration: 'P1M',
      isActive: true,
    });
  });

  it('lists only active plans', async () => {
    mocks.find.mockReturnValue(leanResult([planRecord]));
    const repository = new SubscriptionPlanRepository();

    await expect(repository.listActive()).resolves.toEqual([
      expect.objectContaining({ id: planRecord._id, isActive: true }),
    ]);
    expect(mocks.find).toHaveBeenCalledWith({ duration: 'P1M', isActive: true });
  });
});
