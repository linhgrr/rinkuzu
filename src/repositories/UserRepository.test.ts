import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const userModelMocks = vi.hoisted(() => {
  const findByIdLean = vi.fn();
  const findByIdSelect = vi.fn(() => ({ lean: findByIdLean }));
  const findById = vi.fn(() => ({ select: findByIdSelect }));

  const findOneLean = vi.fn();
  const findOneSelect = vi.fn(() => ({ lean: findOneLean }));
  const findOne = vi.fn(() => ({ select: findOneSelect }));

  const listLean = vi.fn();
  const limit = vi.fn(() => ({ lean: listLean }));
  const skip = vi.fn(() => ({ limit }));
  const sort = vi.fn(() => ({ skip, limit }));
  const listSelect = vi.fn(() => ({ sort }));
  const find = vi.fn(() => ({ select: listSelect }));

  const updateLean = vi.fn();
  const updateSelect = vi.fn(() => ({ lean: updateLean }));
  const findByIdAndUpdate = vi.fn(() => ({ select: updateSelect }));

  return {
    countDocuments: vi.fn(),
    find,
    findById,
    findByIdAndUpdate,
    findByIdLean,
    findByIdSelect,
    findOne,
    findOneLean,
    findOneSelect,
    listLean,
    limit,
    skip,
    sort,
    listSelect,
    updateLean,
    updateSelect,
  };
});

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/User', () => ({
  default: {
    countDocuments: userModelMocks.countDocuments,
    find: userModelMocks.find,
    findById: userModelMocks.findById,
    findByIdAndUpdate: userModelMocks.findByIdAndUpdate,
    findOne: userModelMocks.findOne,
  },
}));

import { UserRepository } from '@/repositories/UserRepository';

const USER_ENTITY_PROJECTION = '_id email name displayName bio avatar role subscription createdAt';
const userRecord = {
  _id: new Types.ObjectId('507f191e810c19729de860ea'),
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'user' as const,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('UserRepository entity projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userModelMocks.findByIdLean.mockResolvedValue(userRecord);
    userModelMocks.findOneLean.mockResolvedValue(userRecord);
    userModelMocks.listLean.mockResolvedValue([userRecord]);
    userModelMocks.updateLean.mockResolvedValue({ ...userRecord, role: 'admin' });
    userModelMocks.countDocuments.mockResolvedValue(1);
  });

  it('allowlists entity fields for single-user reads', async () => {
    const repository = new UserRepository();

    await expect(repository.findById(String(userRecord._id))).resolves.toMatchObject({
      email: userRecord.email,
    });
    await expect(repository.findByEmail(userRecord.email)).resolves.toMatchObject({
      email: userRecord.email,
    });

    expect(userModelMocks.findByIdSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(userModelMocks.findOneSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
  });

  it('allowlists entity fields for admin lists and role updates', async () => {
    const repository = new UserRepository();

    await expect(repository.findAll({ page: 1, limit: 20 })).resolves.toMatchObject({
      items: [{ email: userRecord.email }],
      pagination: { totalItems: 1 },
    });
    await expect(repository.updateRole(String(userRecord._id), 'admin')).resolves.toMatchObject({
      role: 'admin',
    });

    expect(userModelMocks.listSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(userModelMocks.updateSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(USER_ENTITY_PROJECTION).not.toMatch(/password|token|failedLogin|lockedUntil|lastLogin/i);
  });

  it('loads recent users without a count query', async () => {
    const repository = new UserRepository();

    await expect(repository.findRecent(5)).resolves.toMatchObject([{ email: userRecord.email }]);

    expect(userModelMocks.listSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(userModelMocks.limit).toHaveBeenCalledWith(5);
    expect(userModelMocks.countDocuments).not.toHaveBeenCalled();
  });

  it('applies search and role filters with page offsets for admin lists', async () => {
    const repository = new UserRepository();

    await repository.findAll({ page: 2, limit: 10, search: 'learner', role: 'admin' });

    expect(userModelMocks.find).toHaveBeenCalledWith({
      email: { $regex: 'learner', $options: 'i' },
      role: 'admin',
    });
    expect(userModelMocks.skip).toHaveBeenCalledWith(10);
    expect(userModelMocks.limit).toHaveBeenCalledWith(10);
  });

  it('maps subscription snapshots and public profiles while omitting missing data', async () => {
    userModelMocks.findByIdLean
      .mockResolvedValueOnce({
        subscription: {
          type: 'premium',
          isActive: true,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
        },
      })
      .mockResolvedValueOnce({ subscription: undefined })
      .mockResolvedValueOnce({
        _id: userRecord._id,
        email: userRecord.email,
        displayName: 'Learner',
        bio: 'Hello',
        avatar: 'https://example.com/a.png',
        createdAt: userRecord.createdAt,
      })
      .mockResolvedValueOnce(null);

    const repository = new UserRepository();
    await expect(repository.findSubscriptionById(String(userRecord._id))).resolves.toMatchObject({
      type: 'premium',
      isActive: true,
    });
    await expect(repository.findSubscriptionById(String(userRecord._id))).resolves.toBeNull();
    await expect(repository.findPublicProfileById(String(userRecord._id))).resolves.toMatchObject({
      displayName: 'Learner',
      bio: 'Hello',
    });
    await expect(repository.findPublicProfileById(String(userRecord._id))).resolves.toBeNull();
  });
});
