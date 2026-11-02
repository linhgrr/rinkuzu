import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const userModelMocks = vi.hoisted(() => {
  const lean = vi.fn();
  const maxTimeMS = vi.fn(() => ({ lean }));
  const limit = vi.fn(() => ({ maxTimeMS }));
  const sort = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ sort }));
  const find = vi.fn(() => ({ select }));
  return { find, select, sort, limit, maxTimeMS, lean };
});

vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/User', () => ({ default: { find: userModelMocks.find } }));

import { UserIdentityRepository } from '@/repositories/UserIdentityRepository';

const learnerId = '507f191e810c19729de860ea';
const otherId = '507f191e810c19729de860eb';

describe('UserIdentityRepository.findByNameOrEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches name, displayName and email with the term escaped as a literal', async () => {
    userModelMocks.lean.mockResolvedValue([]);

    await new UserIdentityRepository().findByNameOrEmail('  a.b+c  ', 20);

    const pattern = { $regex: 'a\\.b\\+c', $options: 'i' };
    expect(userModelMocks.find).toHaveBeenCalledWith({
      $or: [{ email: pattern }, { name: pattern }, { displayName: pattern }],
    });
    expect(userModelMocks.select).toHaveBeenCalledWith('email name displayName');
    expect(userModelMocks.sort).toHaveBeenCalledWith({ _id: 1 });
    expect(userModelMocks.limit).toHaveBeenCalledWith(20);
    expect(userModelMocks.maxTimeMS).toHaveBeenCalledWith(2000);
  });

  it('maps only id, email and a trimmed display label', async () => {
    userModelMocks.lean.mockResolvedValue([
      {
        _id: new Types.ObjectId(learnerId),
        email: 'learner@example.com',
        name: 'Ignored',
        displayName: ' Learner ',
        role: 'user',
      },
      { _id: new Types.ObjectId(otherId), email: 'no-name@example.com', name: '  ' },
    ]);

    await expect(new UserIdentityRepository().findByNameOrEmail('learner', 20)).resolves.toEqual([
      { id: learnerId, email: 'learner@example.com', displayName: 'Learner' },
      { id: otherId, email: 'no-name@example.com' },
    ]);
  });

  it('falls back to name when there is no display name', async () => {
    userModelMocks.lean.mockResolvedValue([
      { _id: new Types.ObjectId(learnerId), email: 'l@example.com', name: 'Real Name' },
    ]);

    await expect(new UserIdentityRepository().findByNameOrEmail('real', 20)).resolves.toEqual([
      { id: learnerId, email: 'l@example.com', displayName: 'Real Name' },
    ]);
  });

  it('treats a blank search as no search at all', async () => {
    await expect(new UserIdentityRepository().findByNameOrEmail('   ', 20)).resolves.toEqual([]);
    expect(userModelMocks.find).not.toHaveBeenCalled();
  });
});
