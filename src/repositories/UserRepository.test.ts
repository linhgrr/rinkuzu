import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const userModelMocks = vi.hoisted(() => {
  // Chain: findById/findOne → select → session → lean (txn path)
  // and findById/findOne → select → lean (non-txn path)
  const findByIdLean = vi.fn();
  const findByIdSession = vi.fn(() => ({ lean: findByIdLean }));
  const findByIdSelect = vi.fn(() => ({ session: findByIdSession, lean: findByIdLean }));
  const findById = vi.fn(() => ({ select: findByIdSelect }));

  const findOneLean = vi.fn();
  const findOneSession = vi.fn(() => ({ lean: findOneLean }));
  const findOneSelect = vi.fn(() => ({ session: findOneSession, lean: findOneLean }));
  const findOne = vi.fn(() => ({ select: findOneSelect }));

  const listLean = vi.fn();
  const limit = vi.fn(() => ({ lean: listLean }));
  const skip = vi.fn(() => ({ limit }));
  const sort = vi.fn(() => ({ skip, limit }));
  const listSelect = vi.fn(() => ({ sort }));
  const find = vi.fn(() => ({ select: listSelect }));

  const findOneAndUpdateLean = vi.fn();
  const findOneAndUpdateSelect = vi.fn(() => ({ lean: findOneAndUpdateLean }));
  const findOneAndUpdate = vi.fn(() => ({ select: findOneAndUpdateSelect }));

  return {
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
    find,
    findById,
    findByIdLean,
    findByIdSelect,
    findByIdSession,
    findOne,
    findOneLean,
    findOneSelect,
    findOneSession,
    findOneAndUpdate,
    findOneAndUpdateLean,
    findOneAndUpdateSelect,
    listLean,
    limit,
    skip,
    sort,
    listSelect,
  };
});

const fenceMocks = vi.hoisted(() => {
  const lean = vi.fn();
  const findOneAndUpdate = vi.fn(() => ({ lean }));
  return { findOneAndUpdate, lean };
});

const mongooseMocks = vi.hoisted(() => {
  const withTransaction = vi.fn();
  const endSession = vi.fn();
  const startSession = vi.fn(async () => ({
    withTransaction,
    endSession,
  }));
  return { startSession, withTransaction, endSession };
});

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/User', () => ({
  default: {
    aggregate: userModelMocks.aggregate,
    countDocuments: userModelMocks.countDocuments,
    find: userModelMocks.find,
    findById: userModelMocks.findById,
    findOne: userModelMocks.findOne,
    findOneAndUpdate: userModelMocks.findOneAndUpdate,
  },
}));

vi.mock('@/models/AdminMutationFence', () => ({
  default: {
    findOneAndUpdate: fenceMocks.findOneAndUpdate,
  },
}));

vi.mock('mongoose', async () => {
  const actual = await vi.importActual<typeof import('mongoose')>('mongoose');
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: mongooseMocks.startSession,
    },
    startSession: mongooseMocks.startSession,
  };
});

import { UserRepository } from '@/repositories/UserRepository';
import {
  ActorNotActiveAdminError,
  AdminInvariantUnavailableError,
  AdminMutationConflictError,
  AdminMutationTargetNotFoundError,
  LastActiveAdminError,
} from '@/entities/AdminMutation';

// Loose mock aliases — chain shapes vary per test; keep runtime behavior strict.
type LooseMock = {
  mockImplementation: (fn: (...args: unknown[]) => unknown) => unknown;
  mock: { calls: unknown[][] };
};
const fenceFindOneAndUpdate = fenceMocks.findOneAndUpdate as LooseMock;
const userFindOneSelect = userModelMocks.findOneSelect as LooseMock;
const userFindByIdSelect = userModelMocks.findByIdSelect as LooseMock;
const userFindOneAndUpdate = userModelMocks.findOneAndUpdate as LooseMock;

const actorId = '507f191e810c19729de860ea';
const targetId = '507f191e810c19729de860eb';
const otherAdminId = '507f191e810c19729de860ec';

const actorRecord = {
  _id: new Types.ObjectId(actorId),
  email: 'admin@example.com',
  role: 'admin' as const,
  disable: 0 as const,
  disabledAt: null,
  disabledBy: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const targetUserRecord = {
  _id: new Types.ObjectId(targetId),
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'user' as const,
  disable: 0 as const,
  disabledAt: null,
  disabledBy: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

const targetAdminRecord = {
  ...targetUserRecord,
  role: 'admin' as const,
  email: 'other-admin@example.com',
};

describe('UserRepository entity projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userModelMocks.aggregate.mockResolvedValue([targetUserRecord]);
    userModelMocks.findOneLean.mockResolvedValue(targetUserRecord);
    userModelMocks.countDocuments.mockResolvedValue(1);
  });

  it('projects canonical entitlement accounts and requires disable 0 for single-user reads', async () => {
    const repository = new UserRepository();
    const id = String(targetUserRecord._id);

    await expect(repository.findById(id)).resolves.toMatchObject({
      email: targetUserRecord.email,
      disable: 0,
    });
    await expect(repository.findByEmail(targetUserRecord.email)).resolves.toMatchObject({
      email: targetUserRecord.email,
      disable: 0,
    });

    const firstPipeline = userModelMocks.aggregate.mock.calls[0]?.[0];
    const secondPipeline = userModelMocks.aggregate.mock.calls[1]?.[0];
    expect(firstPipeline[0]).toEqual({
      $match: { _id: new Types.ObjectId(id), disable: 0 },
    });
    expect(secondPipeline[0]).toEqual({
      $match: { email: targetUserRecord.email, disable: 0 },
    });
    expect(JSON.stringify(firstPipeline)).toContain('entitlementaccounts');
    expect(JSON.stringify(firstPipeline)).not.toContain('authVersion');
  });

  it('returns null when findById or findByEmail misses', async () => {
    userModelMocks.aggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const repository = new UserRepository();

    await expect(repository.findById(String(targetUserRecord._id))).resolves.toBeNull();
    await expect(repository.findByEmail(targetUserRecord.email)).resolves.toBeNull();
  });

  it('allowlists entity fields for admin lists', async () => {
    const repository = new UserRepository();

    await expect(repository.findAll({ page: 1, limit: 20 })).resolves.toMatchObject({
      items: [{ email: targetUserRecord.email, disable: 0 }],
      pagination: { totalItems: 1 },
    });

    const pipeline = userModelMocks.aggregate.mock.calls[0]?.[0];
    expect(JSON.stringify(pipeline)).toContain('entitlementaccounts');
    expect(JSON.stringify(pipeline)).not.toMatch(
      /password|token|failedLogin|lockedUntil|lastLogin/i,
    );
  });

  it('loads recent users without a count query and sorts newest first', async () => {
    const repository = new UserRepository();

    await expect(repository.findRecent(5)).resolves.toMatchObject([
      { email: targetUserRecord.email },
    ]);

    const pipeline = userModelMocks.aggregate.mock.calls[0]?.[0];
    expect(pipeline).toContainEqual({ $sort: { createdAt: -1 } });
    expect(pipeline).toContainEqual({ $limit: 5 });
    expect(userModelMocks.countDocuments).not.toHaveBeenCalled();
  });

  it('applies search, role, and disable filters with page offsets for admin lists', async () => {
    const repository = new UserRepository();

    await repository.findAll({
      page: 2,
      limit: 10,
      search: 'learner',
      role: 'admin',
      disable: 1,
    });

    const pipeline = userModelMocks.aggregate.mock.calls[0]?.[0];
    expect(pipeline[0]).toEqual({
      $match: {
        email: { $regex: 'learner', $options: 'i' },
        role: 'admin',
        disable: 1,
      },
    });
    expect(pipeline).toContainEqual({ $skip: 10 });
    expect(pipeline).toContainEqual({ $limit: 10 });
  });

  it('escapes regex metacharacters so admin search is a literal match', async () => {
    const repository = new UserRepository();

    await repository.findAll({
      page: 1,
      limit: 10,
      search: 'a.b+c*d[e]f^g$h(i)j',
    });

    expect(userModelMocks.aggregate.mock.calls[0]?.[0]?.[0]).toEqual({
      $match: {
        email: {
          $regex: 'a\\.b\\+c\\*d\\[e\\]f\\^g\\$h\\(i\\)j',
          $options: 'i',
        },
      },
    });

    userModelMocks.aggregate.mockClear();
    await repository.findAll({ page: 1, limit: 5, search: 'user+admin@example.com' });
    expect(userModelMocks.aggregate.mock.calls[0]?.[0]?.[0]).toEqual({
      $match: { email: { $regex: 'user\\+admin@example\\.com', $options: 'i' } },
    });
  });

  it('requires active disable filter for public profile reads', async () => {
    const repository = new UserRepository();
    const id = String(targetUserRecord._id);
    userModelMocks.findOneLean.mockResolvedValueOnce({
      _id: targetUserRecord._id,
      email: targetUserRecord.email,
      createdAt: targetUserRecord.createdAt,
    });

    await repository.findPublicProfileById(id);

    expect(userModelMocks.findOne).toHaveBeenCalledWith({ _id: id, disable: 0 });
  });
});

describe('UserRepository.applyAdminMutation', () => {
  const now = new Date('2026-07-18T00:00:00.000Z');
  const callOrder: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;

    mongooseMocks.withTransaction.mockImplementation(async (callback: () => Promise<unknown>) => {
      callOrder.push('withTransaction:start');
      const value = await callback();
      callOrder.push('withTransaction:end');
      return value;
    });

    fenceFindOneAndUpdate.mockImplementation(() => {
      callOrder.push('fence:touch');
      return {
        lean: async () => {
          callOrder.push('fence:lean');
          return {
            _id: 'active-admin',
            revision: 1,
            updatedAt: now,
          };
        },
      };
    });

    // findOne().select().session().lean() — actor re-read
    userFindOneSelect.mockImplementation(() => {
      callOrder.push('actor:select');
      return {
        session: () => {
          callOrder.push('actor:read');
          return {
            lean: async () => {
              callOrder.push('actor:lean');
              return actorRecord;
            },
          };
        },
        lean: async () => actorRecord,
      };
    });

    // findById().select().session().lean() — target re-read
    userFindByIdSelect.mockImplementation(() => {
      callOrder.push('target:select');
      return {
        session: () => {
          callOrder.push('target:read');
          return {
            lean: async () => {
              callOrder.push('target:lean');
              return targetUserRecord;
            },
          };
        },
        lean: async () => targetUserRecord,
      };
    });

    userModelMocks.countDocuments.mockImplementation(async () => {
      callOrder.push('count:activeAdmins');
      return 2;
    });

    userFindOneAndUpdate.mockImplementation((_filter, update) => {
      callOrder.push('user:write');
      const setFields =
        update && typeof update === 'object' && '$set' in update
          ? (update as { $set: Record<string, unknown> }).$set
          : {};
      const isRole = 'role' in setFields;
      return {
        select: () => ({
          lean: async () => {
            callOrder.push('user:write:lean');
            if (isRole) {
              return { ...targetUserRecord, role: setFields['role'] };
            }
            return {
              ...targetUserRecord,
              disable: setFields['disable'],
              disabledAt: setFields['disabledAt'] ?? null,
              disabledBy: setFields['disabledBy'] ?? null,
            };
          },
        }),
      };
    });
  });

  it('touches fence before actor/target/count reads and returns callback result on retry', async () => {
    let callbackRuns = 0;
    const results: unknown[] = [];
    mongooseMocks.withTransaction.mockImplementation(async (callback: () => Promise<unknown>) => {
      // withTransaction may retry the callback; only the final returned value is used.
      // First run result is discarded (no outer capture of intermediate side effects).
      callbackRuns += 1;
      results.push(await callback());
      callbackRuns += 1;
      const finalResult = await callback();
      results.push(finalResult);
      return finalResult;
    });

    const result = await new UserRepository().applyAdminMutation({
      kind: 'role',
      targetUserId: targetId,
      role: 'admin',
      actor: { id: actorId, email: 'admin@example.com' },
    });

    expect(result).toMatchObject({ kind: 'role', changed: true, role: 'admin' });
    expect(callbackRuns).toBe(2);
    expect(results[1]).toEqual(result);
    expect(callOrder.indexOf('fence:touch')).toBeLessThan(callOrder.indexOf('actor:read'));
    expect(callOrder.indexOf('fence:touch')).toBeLessThan(callOrder.indexOf('target:read'));
    expect(mongooseMocks.endSession).toHaveBeenCalled();
  });

  it('no-op role still touches fence but does not write/authVersion-increment user', async () => {
    userFindByIdSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => ({ ...targetUserRecord, role: 'user' }),
      }),
      lean: async () => ({ ...targetUserRecord, role: 'user' }),
    }));

    const result = await new UserRepository().applyAdminMutation({
      kind: 'role',
      targetUserId: targetId,
      role: 'user',
      actor: { id: actorId, email: 'admin@example.com' },
    });

    expect(result).toMatchObject({ kind: 'role', changed: false, role: 'user' });
    expect(callOrder).toContain('fence:touch');
    expect(userModelMocks.findOneAndUpdate).not.toHaveBeenCalled();
    expect(callOrder).not.toContain('count:activeAdmins');
  });

  it('actual role change increments authVersion once via $inc', async () => {
    await new UserRepository().applyAdminMutation({
      kind: 'role',
      targetUserId: targetId,
      role: 'admin',
      actor: { id: actorId, email: 'admin@example.com' },
    });

    expect(userModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: targetUserRecord._id, role: 'user' },
      { $set: { role: 'admin' }, $inc: { authVersion: 1 } },
      { new: true, session: expect.anything() },
    );
  });

  it('counts active admins only when demoting an active admin and blocks last admin', async () => {
    userFindByIdSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => targetAdminRecord,
      }),
      lean: async () => targetAdminRecord,
    }));
    userModelMocks.countDocuments.mockResolvedValueOnce(1);

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'user',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(LastActiveAdminError);

    expect(userModelMocks.countDocuments).toHaveBeenCalledWith(
      { role: 'admin', disable: 0 },
      { session: expect.anything() },
    );
    expect(userModelMocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('allows demote when another active admin remains and increments authVersion', async () => {
    userFindByIdSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => targetAdminRecord,
      }),
      lean: async () => targetAdminRecord,
    }));
    userModelMocks.countDocuments.mockResolvedValueOnce(2);
    userFindOneAndUpdate.mockImplementation(() => ({
      select: () => ({
        lean: async () => ({ ...targetAdminRecord, role: 'user' }),
      }),
    }));

    const result = await new UserRepository().applyAdminMutation({
      kind: 'role',
      targetUserId: targetId,
      role: 'user',
      actor: { id: actorId, email: 'admin@example.com' },
    });

    expect(result).toMatchObject({ kind: 'role', changed: true, role: 'user' });
    expect(userModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
      { $set: { role: 'user' }, $inc: { authVersion: 1 } },
      { new: true, session: expect.anything() },
    );
  });

  it('no-op disable touches fence without authVersion write', async () => {
    userFindByIdSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => ({ ...targetUserRecord, disable: 1 }),
      }),
      lean: async () => ({ ...targetUserRecord, disable: 1 }),
    }));

    const result = await new UserRepository().applyAdminMutation({
      kind: 'disable',
      targetUserId: targetId,
      disable: 1,
      actor: { id: actorId, email: 'admin@example.com' },
      now,
    });

    expect(result).toMatchObject({ kind: 'disable', changed: false, disable: 1 });
    expect(callOrder).toContain('fence:touch');
    expect(userModelMocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('actual disable increments authVersion and unsets security tokens', async () => {
    const result = await new UserRepository().applyAdminMutation({
      kind: 'disable',
      targetUserId: targetId,
      disable: 1,
      actor: { id: actorId, email: 'admin@example.com' },
      now,
    });

    expect(result).toMatchObject({ kind: 'disable', changed: true, disable: 1 });
    expect(userModelMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: targetUserRecord._id, disable: 0 },
      {
        $set: {
          disable: 1,
          disabledAt: now,
          disabledBy: expect.any(Types.ObjectId),
        },
        $inc: { authVersion: 1 },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpires: 1,
          emailVerificationTokenHash: 1,
          emailVerificationExpires: 1,
        },
      },
      { new: true, session: expect.anything() },
    );
  });

  it('restore clears metadata without recreating security tokens', async () => {
    userFindByIdSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => ({
          ...targetUserRecord,
          disable: 1,
          disabledAt: now,
          disabledBy: new Types.ObjectId(actorId),
        }),
      }),
      lean: async () => ({
        ...targetUserRecord,
        disable: 1,
        disabledAt: now,
        disabledBy: new Types.ObjectId(actorId),
      }),
    }));
    userFindOneAndUpdate.mockImplementation(() => ({
      select: () => ({
        lean: async () => ({
          ...targetUserRecord,
          disable: 0,
          disabledAt: null,
          disabledBy: null,
        }),
      }),
    }));

    const result = await new UserRepository().applyAdminMutation({
      kind: 'disable',
      targetUserId: targetId,
      disable: 0,
      actor: { id: actorId, email: 'admin@example.com' },
      now,
    });

    expect(result).toMatchObject({ kind: 'disable', changed: true, disable: 0 });
    const updateArg = userFindOneAndUpdate.mock.calls.at(0)?.at(1);
    expect(updateArg).toEqual({
      $set: {
        disable: 0,
        disabledAt: null,
        disabledBy: null,
      },
      $inc: { authVersion: 1 },
    });
  });

  it('blocks disabling the last active admin', async () => {
    userFindByIdSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => ({ ...actorRecord, _id: new Types.ObjectId(otherAdminId) }),
      }),
      lean: async () => ({ ...actorRecord, _id: new Types.ObjectId(otherAdminId) }),
    }));
    userModelMocks.countDocuments.mockResolvedValueOnce(1);

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'disable',
        targetUserId: otherAdminId,
        disable: 1,
        actor: { id: actorId, email: 'admin@example.com' },
        now,
      }),
    ).rejects.toBeInstanceOf(LastActiveAdminError);
  });

  it('maps missing fence to AdminInvariantUnavailableError', async () => {
    fenceFindOneAndUpdate.mockImplementation(() => ({
      lean: async () => null,
    }));

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(AdminInvariantUnavailableError);
  });

  it('maps missing transaction support to AdminInvariantUnavailableError', async () => {
    mongooseMocks.withTransaction.mockRejectedValueOnce(
      new Error('Transaction numbers are only allowed on a replica set member or mongos'),
    );

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(AdminInvariantUnavailableError);
  });

  it('maps operational startSession failure to AdminInvariantUnavailableError', async () => {
    const operationalError = new Error('session factory down');
    operationalError.name = 'MongoServerSelectionError';
    mongooseMocks.startSession.mockRejectedValueOnce(operationalError);

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(AdminInvariantUnavailableError);
  });

  it('does not disguise unexpected startSession errors as infrastructure outages', async () => {
    const programmerError = new Error('unexpected session factory bug');
    mongooseMocks.startSession.mockRejectedValueOnce(programmerError);

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBe(programmerError);
  });

  it('throws ActorNotActiveAdminError when actor re-read fails', async () => {
    userFindOneSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => null,
      }),
      lean: async () => null,
    }));

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(ActorNotActiveAdminError);
  });

  it('throws AdminMutationTargetNotFoundError when target is missing', async () => {
    userFindByIdSelect.mockImplementation(() => ({
      session: () => ({
        lean: async () => null,
      }),
      lean: async () => null,
    }));

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(AdminMutationTargetNotFoundError);
  });

  it('throws AdminMutationConflictError when conditional write misses', async () => {
    userFindOneAndUpdate.mockImplementation(() => ({
      select: () => ({
        lean: async () => null,
      }),
    }));

    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: targetId,
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(AdminMutationConflictError);
  });

  it('rejects invalid object ids without opening a session', async () => {
    await expect(
      new UserRepository().applyAdminMutation({
        kind: 'role',
        targetUserId: 'not-valid',
        role: 'admin',
        actor: { id: actorId, email: 'admin@example.com' },
      }),
    ).rejects.toBeInstanceOf(AdminMutationTargetNotFoundError);
    expect(mongooseMocks.startSession).not.toHaveBeenCalled();
  });
});
