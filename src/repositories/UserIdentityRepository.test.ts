import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const userModelMocks = vi.hoisted(() => {
  const lean = vi.fn();
  const limit = vi.fn(() => ({ lean }));
  const select = vi.fn(() => ({ lean, limit }));
  const find = vi.fn(() => ({ select }));
  return { find, select, limit, lean };
});

vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/User', () => ({ default: { find: userModelMocks.find } }));

import { UserIdentityRepository } from '@/repositories/UserIdentityRepository';

const learnerId = '507f191e810c19729de860ea';
const otherId = '507f191e810c19729de860eb';

describe('UserIdentityRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads disabled accounts too and drops ids Mongo cannot address', async () => {
    userModelMocks.lean.mockResolvedValue([
      {
        _id: new Types.ObjectId(learnerId),
        email: 'learner@example.com',
        name: 'Ignored',
        displayName: ' Learner ',
      },
      { _id: new Types.ObjectId(otherId), email: 'no-name@example.com' },
    ]);

    await expect(
      new UserIdentityRepository().findIdentitiesByIds([
        learnerId,
        learnerId,
        otherId,
        'not-an-object-id',
      ]),
    ).resolves.toEqual([
      { id: learnerId, email: 'learner@example.com', displayName: 'Learner' },
      { id: otherId, email: 'no-name@example.com' },
    ]);
    expect(userModelMocks.find).toHaveBeenCalledWith({
      _id: { $in: [new Types.ObjectId(learnerId), new Types.ObjectId(otherId)] },
    });
    expect(userModelMocks.select).toHaveBeenCalledWith('email name displayName');
  });

  it('skips the query when no id is addressable', async () => {
    const repository = new UserIdentityRepository();

    await expect(repository.findIdentitiesByIds(['nope'])).resolves.toEqual([]);
    await expect(repository.findIdentitiesByIds([])).resolves.toEqual([]);
    expect(userModelMocks.find).not.toHaveBeenCalled();
  });

  it('searches name, displayName and email with the term escaped as a literal', async () => {
    userModelMocks.lean.mockResolvedValue([{ _id: new Types.ObjectId(learnerId) }]);

    await expect(new UserIdentityRepository().findIdsByNameOrEmail('a.b+c', 50)).resolves.toEqual([
      learnerId,
    ]);

    const pattern = { $regex: 'a\\.b\\+c', $options: 'i' };
    expect(userModelMocks.find).toHaveBeenCalledWith({
      $or: [{ email: pattern }, { name: pattern }, { displayName: pattern }],
    });
    expect(userModelMocks.limit).toHaveBeenCalledWith(50);
  });

  it('treats a blank search as no search at all', async () => {
    await expect(new UserIdentityRepository().findIdsByNameOrEmail('   ', 50)).resolves.toEqual([]);
    expect(userModelMocks.find).not.toHaveBeenCalled();
  });
});
