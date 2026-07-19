import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import {
  applyActiveAdminFenceCreate,
  buildActiveAdminFencePlan,
  createActiveAdminFencePlanSha,
  createSourceFingerprint,
  inspectActiveAdminFenceMigration,
  isCanonicalFence,
  isMalformedFence,
  isNonNegativeInteger,
  validateActiveAdminFenceMigration,
  validateActiveAdminFenceMigrationModes,
  verifyActiveAdminFencePostcondition,
} from '../../scripts/migrate-active-admin-fence.mjs';

type FenceDoc = {
  _id: string;
  revision?: unknown;
  updatedAt?: unknown;
};

type FakeUserDoc = {
  _id: ObjectId | string;
  role?: string;
  disable?: unknown;
  authVersion?: unknown;
  disabledAt?: unknown;
  disabledBy?: unknown;
};

/**
 * Faithful in-memory collections for migration apply/verify.
 * Never connects to a live database or reads env secrets.
 */
function createFakeDb(options: {
  users?: FakeUserDoc[];
  fence?: FenceDoc | null;
  failInsert?: boolean;
  duplicateInsert?: boolean;
}) {
  const users = (options.users ?? []).map((doc) => ({
    disable: 0,
    authVersion: 0,
    disabledAt: null,
    disabledBy: null,
    ...doc,
  }));
  let fence: FenceDoc | null =
    options.fence === undefined ? null : options.fence === null ? null : { ...options.fence };

  return {
    collection(name: string) {
      if (name !== 'users' && name !== 'adminmutationfences') {
        throw new Error(`unexpected collection ${name}`);
      }

      return {
        find(filter: Record<string, unknown>, _options: Record<string, unknown>) {
          if (name !== 'users') throw new Error(`find is unsupported for ${name}`);
          const matched = users.filter(
            (doc) =>
              (filter['role'] === undefined || doc.role === filter['role']) &&
              (filter['disable'] === undefined || doc.disable === filter['disable']),
          );
          return {
            async toArray() {
              return matched.map((doc) => ({ ...doc }));
            },
          };
        },
        async countDocuments(filter: Record<string, unknown>) {
          if (name !== 'users') throw new Error(`countDocuments is unsupported for ${name}`);
          return users.filter(
            (doc) =>
              (filter['role'] === undefined || doc.role === filter['role']) &&
              (filter['disable'] === undefined || doc.disable === filter['disable']),
          ).length;
        },
        async findOne(filter: Record<string, unknown>) {
          if (name !== 'adminmutationfences') {
            throw new Error(`findOne is unsupported for ${name}`);
          }
          if (filter['_id'] !== 'active-admin') return null;
          return fence ? { ...fence } : null;
        },
        async insertOne(doc: Record<string, unknown>, _options: Record<string, unknown>) {
          if (name !== 'adminmutationfences') {
            throw new Error(`insertOne is unsupported for ${name}`);
          }
          if (options.failInsert) {
            throw new Error('insert failed');
          }
          if (options.duplicateInsert || fence != null) {
            const err = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
            throw err;
          }
          if (
            doc['_id'] !== 'active-admin' ||
            typeof doc['revision'] !== 'number' ||
            !(doc['updatedAt'] instanceof Date)
          ) {
            throw new Error('invalid fence document');
          }
          fence = {
            _id: doc['_id'],
            revision: doc['revision'],
            updatedAt: doc['updatedAt'],
          };
          return { acknowledged: true, insertedId: doc['_id'] };
        },
      };
    },
    get fence() {
      return fence;
    },
  };
}

describe('migrate-active-admin-fence pure helpers', () => {
  it('fails closed when an active-admin projection violates the required _id contract', () => {
    expect(() =>
      buildActiveAdminFencePlan(
        // Runtime guard protects against malformed adapters despite the stricter JSDoc boundary.
        [{ _id: undefined }],
        null,
      ),
    ).toThrow(/active admin is missing _id/);
  });

  it('validates nonnegative integers and canonical fence shape', () => {
    expect(isNonNegativeInteger(0)).toBe(true);
    expect(isNonNegativeInteger(3)).toBe(true);
    expect(isNonNegativeInteger(-1)).toBe(false);
    expect(isNonNegativeInteger(1.5)).toBe(false);

    expect(
      isCanonicalFence({
        _id: 'active-admin',
        revision: 0,
        updatedAt: new Date('2026-07-19T00:00:00.000Z'),
      }),
    ).toBe(true);
    expect(isCanonicalFence(null)).toBe(false);
    expect(
      isCanonicalFence({
        _id: 'active-admin',
        revision: 1.2,
        updatedAt: new Date(),
      }),
    ).toBe(false);
    expect(isMalformedFence(null)).toBe(false);
    expect(
      isMalformedFence({
        _id: 'active-admin',
        revision: 'x',
        updatedAt: new Date(),
      }),
    ).toBe(true);
  });

  it('emits deterministic order-independent sourceFingerprint and planSha', () => {
    const a = new ObjectId().toHexString();
    const b = new ObjectId().toHexString();
    const fence = {
      _id: 'active-admin',
      revision: 2,
      updatedAt: new Date('2026-07-19T00:00:00.000Z'),
    };

    const fp1 = createSourceFingerprint([a, b], fence);
    const fp2 = createSourceFingerprint([b, a], fence);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64);

    const expectedFp = createHash('sha256')
      .update(
        JSON.stringify({
          fenceId: 'active-admin',
          activeAdminIds: [a, b].sort((x, y) => x.localeCompare(y)),
          fenceState: {
            revision: 2,
            updatedAt: '2026-07-19T00:00:00.000Z',
            canonical: true,
          },
        }),
      )
      .digest('hex');
    expect(fp1).toBe(expectedFp);

    const planA = buildActiveAdminFencePlan([{ _id: a }, { _id: b }], null);
    const planB = buildActiveAdminFencePlan([{ _id: b }, { _id: a }], null);
    expect(planA.mode).toBe('create');
    expect(planA.planSha).toBe(planB.planSha);
    expect(planA.sourceFingerprint).toBe(planB.sourceFingerprint);
    expect(planA.planSha).toBe(
      createActiveAdminFencePlanSha({
        mode: 'create',
        sourceFingerprint: planA.sourceFingerprint,
        activeAdminCount: 2,
      }),
    );
  });

  it('fails closed on zero active admins', () => {
    expect(() => buildActiveAdminFencePlan([], null)).toThrow(/zero active admins/);
  });

  it('fails closed on malformed existing fence', () => {
    expect(() =>
      buildActiveAdminFencePlan([{ _id: new ObjectId() }], {
        _id: 'active-admin',
        revision: -1,
        updatedAt: new Date(),
      }),
    ).toThrow(/malformed/);
  });

  it('missing fence yields create plan; canonical fence yields noop', () => {
    const id = new ObjectId();
    const createPlan = buildActiveAdminFencePlan([{ _id: id }], null);
    expect(createPlan.mode).toBe('create');
    expect(createPlan.fenceState).toBeNull();

    const noopPlan = buildActiveAdminFencePlan([{ _id: id }], {
      _id: 'active-admin',
      revision: 0,
      updatedAt: new Date('2026-07-19T00:00:00.000Z'),
    });
    expect(noopPlan.mode).toBe('noop');
    expect(noopPlan.fenceState).toMatchObject({ revision: 0, canonical: true });
  });

  it('validates modes and approval SHA', () => {
    expect(() => validateActiveAdminFenceMigrationModes({ apply: true, verifyOnly: true })).toThrow(
      /Cannot combine/,
    );
    expect(() => validateActiveAdminFenceMigrationModes({ apply: true })).toThrow(
      /requires --approve-plan/,
    );
    expect(() =>
      validateActiveAdminFenceMigrationModes({
        apply: false,
        approvedPlanSha: 'abc',
      }),
    ).toThrow(/only valid with --apply/);

    const plan = buildActiveAdminFencePlan([{ _id: new ObjectId() }], null);
    expect(() =>
      validateActiveAdminFenceMigration({
        apply: true,
        approvedPlanSha: 'deadbeef',
        plan,
      }),
    ).toThrow(/mismatch/);
    expect(() =>
      validateActiveAdminFenceMigration({
        apply: true,
        approvedPlanSha: plan.planSha,
        plan,
      }),
    ).not.toThrow();
  });
});

describe('migrate-active-admin-fence apply/verify (in-memory)', () => {
  it('conditionally creates fence without upsert and verifies', async () => {
    const adminId = new ObjectId();
    const db = createFakeDb({
      users: [{ _id: adminId, role: 'admin', disable: 0 }],
      fence: null,
    });
    const plan = buildActiveAdminFencePlan([{ _id: adminId }], null);
    expect(plan.mode).toBe('create');

    const applied = await applyActiveAdminFenceCreate(
      db,
      plan,
      new Date('2026-07-19T00:00:00.000Z'),
    );
    expect(applied).toEqual({ inserted: true, reason: 'created' });
    expect(db.fence).toMatchObject({
      _id: 'active-admin',
      revision: 0,
      updatedAt: new Date('2026-07-19T00:00:00.000Z'),
    });

    await expect(verifyActiveAdminFencePostcondition(db)).resolves.toMatchObject({
      verified: true,
      activeAdminCount: 1,
      fenceRevision: 0,
    });
  });

  it('fails conditional create when fence already exists or insert conflicts', async () => {
    const adminId = new ObjectId();
    const existing = createFakeDb({
      users: [{ _id: adminId, role: 'admin', disable: 0 }],
      fence: {
        _id: 'active-admin',
        revision: 0,
        updatedAt: new Date(),
      },
    });
    const plan = buildActiveAdminFencePlan([{ _id: adminId }], null);
    await expect(applyActiveAdminFenceCreate(existing, plan)).rejects.toThrow(/already exists/);

    const dupe = createFakeDb({
      users: [{ _id: adminId, role: 'admin', disable: 0 }],
      fence: null,
      duplicateInsert: true,
    });
    await expect(applyActiveAdminFenceCreate(dupe, plan)).rejects.toThrow(/duplicate key/);
  });

  it('verify fails without fence or without active admin', async () => {
    const noFence = createFakeDb({
      users: [{ _id: new ObjectId(), role: 'admin', disable: 0 }],
      fence: null,
    });
    await expect(verifyActiveAdminFencePostcondition(noFence)).rejects.toThrow(
      /missing or not canonical/,
    );

    const noAdmin = createFakeDb({
      users: [{ _id: new ObjectId(), role: 'user', disable: 0 }],
      fence: {
        _id: 'active-admin',
        revision: 0,
        updatedAt: new Date(),
      },
    });
    await expect(verifyActiveAdminFencePostcondition(noAdmin)).rejects.toThrow(
      /at least one active admin/,
    );
  });

  it('fails before fence inspection or verification when user disable state is noncanonical', async () => {
    const db = createFakeDb({
      users: [
        {
          _id: new ObjectId(),
          role: 'admin',
          disable: undefined,
        },
      ],
      fence: {
        _id: 'active-admin',
        revision: 0,
        updatedAt: new Date(),
      },
    });

    await expect(inspectActiveAdminFenceMigration(db)).rejects.toThrow(/invalid disable/);
    await expect(verifyActiveAdminFencePostcondition(db)).rejects.toThrow(/invalid disable/);
  });

  it('is idempotent: second plan is noop after create; re-verify clean', async () => {
    const adminId = new ObjectId();
    const db = createFakeDb({
      users: [{ _id: adminId, role: 'admin', disable: 0 }],
      fence: null,
    });
    const plan = buildActiveAdminFencePlan([{ _id: adminId }], null);
    await applyActiveAdminFenceCreate(db, plan);

    const second = buildActiveAdminFencePlan(
      [{ _id: adminId }],
      db.fence as Record<string, unknown>,
    );
    expect(second.mode).toBe('noop');
    await expect(applyActiveAdminFenceCreate(db, second)).resolves.toEqual({
      inserted: false,
      reason: 'noop',
    });
    await expect(verifyActiveAdminFencePostcondition(db)).resolves.toMatchObject({
      verified: true,
    });
    await expect(verifyActiveAdminFencePostcondition(db)).resolves.toMatchObject({
      verified: true,
    });
  });
});
