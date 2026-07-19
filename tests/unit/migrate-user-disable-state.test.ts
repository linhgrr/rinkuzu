import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import {
  applyUserDisableBackfill,
  buildBackfillFilter,
  buildBackfillSet,
  buildUserDisableMigrationPlan,
  classifyUserDisableDocument,
  createUserDisablePlanSha,
  isValidAuthVersion,
  isValidDisable,
  isValidDisabledAt,
  isValidDisabledBy,
  parsePositiveIntegerOption,
  validateUserDisableMigration,
  validateUserDisableMigrationModes,
  verifyUserDisablePostcondition,
} from '../../scripts/migrate-user-disable-state.mjs';

type FakeUserDoc = {
  _id: ObjectId | string;
  disable?: unknown;
  authVersion?: unknown;
  disabledAt?: unknown;
  disabledBy?: unknown;
};

/**
 * Faithful in-memory Mongo collection for migration apply/verify.
 * Only implements the surface used by applyUserDisableBackfill and
 * verifyUserDisablePostcondition — never connects to a live database.
 */
function createInMemoryUsersCollection(initial: FakeUserDoc[] = []) {
  const docs = initial.map((doc) => ({ ...doc }));

  function matchesFilter(doc: FakeUserDoc, filter: Record<string, unknown>): boolean {
    if (filter['_id'] !== undefined && String(doc._id) !== String(filter['_id'])) {
      return false;
    }
    for (const [key, condition] of Object.entries(filter)) {
      if (key === '_id' || key === '$and') continue;
      if (
        condition &&
        typeof condition === 'object' &&
        !Array.isArray(condition) &&
        '$exists' in (condition as object)
      ) {
        const exists =
          Object.prototype.hasOwnProperty.call(doc, key) &&
          doc[key as keyof FakeUserDoc] !== undefined;
        if ((condition as { $exists: boolean }).$exists !== exists) return false;
        continue;
      }
      if (doc[key as keyof FakeUserDoc] !== condition) return false;
    }
    if (Array.isArray(filter['$and'])) {
      for (const clause of filter['$and'] as Array<Record<string, unknown>>) {
        if (!matchesClause(doc, clause)) return false;
      }
    }
    return true;
  }

  function matchesClause(doc: FakeUserDoc, clause: Record<string, unknown>): boolean {
    if (Array.isArray(clause['$or'])) {
      return (clause['$or'] as Array<Record<string, unknown>>).some((branch) =>
        matchesClause(doc, branch),
      );
    }
    for (const [key, condition] of Object.entries(clause)) {
      if (key === '$or') continue;
      if (
        condition &&
        typeof condition === 'object' &&
        !Array.isArray(condition) &&
        '$exists' in (condition as object)
      ) {
        const exists =
          Object.prototype.hasOwnProperty.call(doc, key) &&
          doc[key as keyof FakeUserDoc] !== undefined;
        if ((condition as { $exists: boolean }).$exists !== exists) return false;
        continue;
      }
      if (doc[key as keyof FakeUserDoc] !== condition) return false;
    }
    return true;
  }

  function matchesCountFilter(doc: FakeUserDoc, filter: Record<string, unknown>): boolean {
    if (
      filter['disable'] &&
      typeof filter['disable'] === 'object' &&
      '$nin' in (filter['disable'] as object)
    ) {
      const nin = (filter['disable'] as { $nin: unknown[] }).$nin;
      return !nin.includes(doc.disable);
    }
    return matchesFilter(doc, filter);
  }

  return {
    docs,
    async updateOne(filter: Record<string, unknown>, update: { $set?: Record<string, unknown> }) {
      const index = docs.findIndex((doc) => matchesFilter(doc, filter));
      if (index < 0) {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      const before = JSON.stringify(docs[index]);
      docs[index] = { ...docs[index], ...(update.$set ?? {}) };
      const modifiedCount = before === JSON.stringify(docs[index]) ? 0 : 1;
      return { matchedCount: 1, modifiedCount };
    },
    async countDocuments(filter: Record<string, unknown> = {}) {
      return docs.filter((doc) => matchesCountFilter(doc, filter)).length;
    },
    find(
      _filter: Record<string, unknown> = {},
      options: { projection?: Record<string, number> } = {},
    ) {
      const projection = options.projection ?? {};
      const projected = docs.map((doc) => {
        if (!projection || Object.keys(projection).length === 0) return { ...doc };
        const out: Record<string, unknown> = { _id: doc._id };
        for (const key of Object.keys(projection)) {
          if (key === '_id') continue;
          // Do not manufacture missing properties as undefined/null — omit them.
          if (!Object.prototype.hasOwnProperty.call(doc, key)) continue;
          out[key] = doc[key as keyof FakeUserDoc];
        }
        return out;
      });
      return {
        sort() {
          return this;
        },
        async toArray() {
          return projected;
        },
      };
    },
  };
}

function createFakeDb(collection: ReturnType<typeof createInMemoryUsersCollection>) {
  // Structural fake for migration helpers only — never a live Mongo client.
  return {
    collection(name: string) {
      if (name !== 'users') throw new Error(`Unexpected collection ${name}`);
      return collection;
    },
  };
}

describe('migrate-user-disable-state pure helpers', () => {
  it('validates disable and authVersion strictly', () => {
    expect(isValidDisable(0)).toBe(true);
    expect(isValidDisable(1)).toBe(true);
    expect(isValidDisable(2)).toBe(false);
    expect(isValidDisable('0')).toBe(false);
    expect(isValidAuthVersion(0)).toBe(true);
    expect(isValidAuthVersion(3)).toBe(true);
    expect(isValidAuthVersion(-1)).toBe(false);
    expect(isValidAuthVersion(1.5)).toBe(false);
  });

  it('accepts only real Date disabledAt and ObjectId disabledBy', () => {
    expect(isValidDisabledAt(new Date('2026-07-01T00:00:00.000Z'))).toBe(true);
    expect(isValidDisabledAt(new Date('not-a-date'))).toBe(false);
    expect(isValidDisabledAt({ getTime: () => Date.now() })).toBe(false);
    expect(isValidDisabledAt('2026-07-01T00:00:00.000Z')).toBe(false);
    expect(isValidDisabledAt(null)).toBe(false);

    const oid = new ObjectId();
    expect(isValidDisabledBy(oid)).toBe(true);
    expect(isValidDisabledBy(String(oid))).toBe(false);
    expect(isValidDisabledBy(null)).toBe(false);
  });

  it('backfills missing disable/authVersion/active metadata', () => {
    expect(classifyUserDisableDocument({ _id: 'a' })).toEqual({
      kind: 'backfill',
      ops: [
        { kind: 'set-disable', value: 0 },
        { kind: 'set-authVersion', value: 0 },
        { kind: 'set-disabledAt', value: null },
        { kind: 'set-disabledBy', value: null },
      ],
    });
  });

  it('fails closed on invalid or contradictory values', () => {
    expect(classifyUserDisableDocument({ _id: 'a', disable: 2, authVersion: 0 })).toMatchObject({
      kind: 'unsafe',
    });
    expect(
      classifyUserDisableDocument({
        _id: 'a',
        disable: 0,
        authVersion: 0,
        disabledAt: new Date(),
      }),
    ).toMatchObject({ kind: 'unsafe', reason: expect.stringContaining('disabledAt') });
    expect(
      classifyUserDisableDocument({
        _id: 'a',
        disable: 0,
        authVersion: -1,
      }),
    ).toMatchObject({ kind: 'unsafe' });
  });

  it('fails closed when disabled metadata is missing, null, string, or getTime-shaped', () => {
    expect(
      classifyUserDisableDocument({
        _id: 'd1',
        disable: 1,
        authVersion: 0,
      }),
    ).toMatchObject({ kind: 'unsafe', reason: expect.stringContaining('disabledAt') });

    expect(
      classifyUserDisableDocument({
        _id: 'd2',
        disable: 1,
        authVersion: 0,
        disabledAt: null,
        disabledBy: new ObjectId(),
      }),
    ).toMatchObject({ kind: 'unsafe', reason: expect.stringContaining('disabledAt') });

    expect(
      classifyUserDisableDocument({
        _id: 'd3',
        disable: 1,
        authVersion: 0,
        disabledAt: '2026-07-01T00:00:00.000Z',
        disabledBy: new ObjectId(),
      }),
    ).toMatchObject({ kind: 'unsafe', reason: expect.stringContaining('disabledAt') });

    expect(
      classifyUserDisableDocument({
        _id: 'd4',
        disable: 1,
        authVersion: 0,
        disabledAt: { getTime: () => Date.now() },
        disabledBy: new ObjectId(),
      }),
    ).toMatchObject({ kind: 'unsafe', reason: expect.stringContaining('disabledAt') });

    expect(
      classifyUserDisableDocument({
        _id: 'd5',
        disable: 1,
        authVersion: 0,
        disabledAt: new Date('2026-07-01T00:00:00.000Z'),
        disabledBy: '507f191e810c19729de860ea',
      }),
    ).toMatchObject({ kind: 'unsafe', reason: expect.stringContaining('disabledBy') });
  });

  it('accepts clean disabled docs with real Date and ObjectId metadata', () => {
    expect(
      classifyUserDisableDocument({
        _id: 'd-ok',
        disable: 1,
        authVersion: 2,
        disabledAt: new Date('2026-07-01T00:00:00.000Z'),
        disabledBy: new ObjectId(),
      }),
    ).toEqual({ kind: 'clean' });
  });

  it('produces a deterministic plan SHA independent of input order', () => {
    const docs = [
      { _id: 'u1' },
      { _id: 'u2', disable: 0, authVersion: 0, disabledAt: null, disabledBy: null },
      { _id: 'u3' },
    ];
    const planA = buildUserDisableMigrationPlan(docs);
    const planB = buildUserDisableMigrationPlan([...docs].reverse());
    expect(planA.planSha).toBe(planB.planSha);
    expect(planA.backfillCount).toBe(2);
    expect(planA.unsafeCount).toBe(0);
    expect(planA.targets.map((t) => String(t.id))).toEqual(['u1', 'u3']);

    const expected = createUserDisablePlanSha(planA.targets, planA.unsafe, planA.documentCount);
    expect(planA.planSha).toBe(expected);
    expect(planA.planSha).toHaveLength(64);
  });

  it('requires exact approve-plan SHA for apply including zero-plan', () => {
    const plan = buildUserDisableMigrationPlan([{ _id: 'u1' }]);
    const zeroPlan = buildUserDisableMigrationPlan([
      {
        _id: 'u1',
        disable: 0,
        authVersion: 0,
        disabledAt: null,
        disabledBy: null,
      },
    ]);

    expect(() =>
      validateUserDisableMigration({
        apply: true,
        maxDocuments: 500,
        plan,
      }),
    ).toThrow(/approve-plan/);

    expect(() =>
      validateUserDisableMigration({
        apply: true,
        approvedPlanSha: 'deadbeef',
        maxDocuments: 500,
        plan,
      }),
    ).toThrow(/mismatch/);

    expect(() =>
      validateUserDisableMigration({
        apply: true,
        approvedPlanSha: plan.planSha,
        maxDocuments: 500,
        plan,
      }),
    ).not.toThrow();

    // Zero-plan apply still requires exact SHA approval.
    expect(() =>
      validateUserDisableMigration({
        apply: true,
        maxDocuments: 500,
        plan: zeroPlan,
      }),
    ).toThrow(/approve-plan/);

    expect(() =>
      validateUserDisableMigration({
        apply: true,
        approvedPlanSha: zeroPlan.planSha,
        maxDocuments: 500,
        plan: zeroPlan,
      }),
    ).not.toThrow();
  });

  it('applies max-documents only on apply, not dry-run inventory', () => {
    const many = Array.from({ length: 3 }, (_, i) => ({ _id: `u${i}` }));
    const plan = buildUserDisableMigrationPlan(many);
    expect(plan.backfillCount).toBe(3);

    // Dry-run reports all backfills even when over the apply cap.
    expect(() =>
      validateUserDisableMigration({ apply: false, maxDocuments: 1, plan }),
    ).not.toThrow();

    expect(() =>
      validateUserDisableMigration({
        apply: true,
        approvedPlanSha: plan.planSha,
        maxDocuments: 1,
        plan,
      }),
    ).toThrow(/max-documents/);
  });

  it('rejects invalid batch size and incompatible modes', () => {
    expect(() => parsePositiveIntegerOption(0, 'batch-size')).toThrow(/positive integer/);
    expect(() => parsePositiveIntegerOption(1.5, 'batch-size')).toThrow(/positive integer/);
    expect(() => parsePositiveIntegerOption(-1, 'batch-size')).toThrow(/positive integer/);
    expect(parsePositiveIntegerOption(10, 'batch-size')).toBe(10);

    expect(() => validateUserDisableMigrationModes({ apply: true, verifyOnly: true })).toThrow(
      /--verify cannot be combined with --apply/,
    );

    expect(() =>
      validateUserDisableMigrationModes({
        apply: false,
        verifyOnly: true,
        approvedPlanSha: 'abc',
      }),
    ).toThrow(/--verify cannot be combined with --approve-plan/);

    expect(() =>
      validateUserDisableMigrationModes({
        apply: false,
        verifyOnly: false,
        approvedPlanSha: 'abc',
      }),
    ).toThrow(/--approve-plan requires --apply/);

    expect(() =>
      validateUserDisableMigrationModes({ apply: false, verifyOnly: false }),
    ).not.toThrow();
  });

  it('fails closed when plan contains unsafe documents even in dry-run validation', () => {
    const plan = buildUserDisableMigrationPlan([{ _id: 'u1', disable: 9, authVersion: 0 }]);
    expect(() => validateUserDisableMigration({ apply: false, maxDocuments: 500, plan })).toThrow(
      /fail-closed/,
    );
  });

  it('builds conditional backfill filters and set docs', () => {
    /** @type {const} */
    const ops = [
      { kind: 'set-disable', value: 0 },
      { kind: 'set-authVersion', value: 0 },
    ] as const;
    expect(buildBackfillSet([...ops])).toEqual({ disable: 0, authVersion: 0 });
    expect(buildBackfillFilter('id-1', [...ops])).toEqual({
      _id: 'id-1',
      disable: { $exists: false },
      authVersion: { $exists: false },
    });
  });

  it('zero-plan after clean documents is idempotent and SHA-stable under reverse', () => {
    const clean = {
      _id: 'u1',
      disable: 0,
      authVersion: 0,
      disabledAt: null,
      disabledBy: null,
    };
    const plan = buildUserDisableMigrationPlan([clean]);
    const reversed = buildUserDisableMigrationPlan([clean, { ...clean, _id: 'u0' }].reverse());
    expect(plan.backfillCount).toBe(0);
    expect(plan.unsafeCount).toBe(0);
    const emptySha = createHash('sha256')
      .update(
        JSON.stringify({
          documentCount: 1,
          targets: [],
          unsafe: [],
        }),
      )
      .digest('hex');
    expect(plan.planSha).toBe(emptySha);
    expect(reversed.planSha).toBe(
      createUserDisablePlanSha(reversed.targets, reversed.unsafe, reversed.documentCount),
    );
  });
});

describe('migrate-user-disable-state apply/verify (in-memory Mongo)', () => {
  it('applies BSON-shaped ObjectId/Date backfill with exact conditional filter/update', async () => {
    const id = new ObjectId();
    const collection = createInMemoryUsersCollection([{ _id: id }]);
    const plan = buildUserDisableMigrationPlan(collection.docs);

    expect(plan.backfillCount).toBe(1);
    expect(plan.targets[0]?.ops).toEqual(
      expect.arrayContaining([
        { kind: 'set-disable', value: 0 },
        { kind: 'set-authVersion', value: 0 },
        { kind: 'set-disabledAt', value: null },
        { kind: 'set-disabledBy', value: null },
      ]),
    );

    const target = plan.targets[0];
    expect(target).toBeDefined();
    if (!target) throw new Error('expected backfill target');
    const filter = buildBackfillFilter(target.id, target.ops);
    const $set = buildBackfillSet(target.ops);
    expect(filter).toMatchObject({
      _id: id,
      disable: { $exists: false },
      authVersion: { $exists: false },
    });
    expect($set).toEqual({
      disable: 0,
      authVersion: 0,
      disabledAt: null,
      disabledBy: null,
    });

    const result = await applyUserDisableBackfill(createFakeDb(collection), plan, {
      batchSize: 10,
    });
    expect(result).toEqual({ modifiedDocuments: 1 });
    expect(collection.docs[0]).toMatchObject({
      _id: id,
      disable: 0,
      authVersion: 0,
      disabledAt: null,
      disabledBy: null,
    });

    await expect(verifyUserDisablePostcondition(createFakeDb(collection))).resolves.toEqual({
      verified: true,
      documentCount: 1,
    });
  });

  it('fails closed on matchedCount mismatch', async () => {
    const id = new ObjectId();
    // Document already has disable, so conditional filter will not match.
    const collection = createInMemoryUsersCollection([
      { _id: id, disable: 0, authVersion: 0, disabledAt: null, disabledBy: null },
    ]);
    const stalePlan = buildUserDisableMigrationPlan([{ _id: id }]);
    expect(stalePlan.backfillCount).toBe(1);

    await expect(
      applyUserDisableBackfill(createFakeDb(collection), stalePlan, { batchSize: 10 }),
    ).rejects.toThrow(/matched=0/);
  });

  it('fails closed on modifiedCount mismatch (already at target values under matching filter)', async () => {
    const id = new ObjectId();
    // Present but filter-matching fields that make $set a no-op: missing fields so filter
    // matches, but we force updateOne to report modifiedCount 0 by pre-setting via a custom
    // collection override.
    const base = createInMemoryUsersCollection([{ _id: id }]);
    const originalUpdateOne = base.updateOne.bind(base);
    base.updateOne = async (filter, update) => {
      await originalUpdateOne(filter, update);
      return { matchedCount: 1, modifiedCount: 0 };
    };

    const plan = buildUserDisableMigrationPlan([{ _id: id }]);
    await expect(
      applyUserDisableBackfill(createFakeDb(base), plan, { batchSize: 5 }),
    ).rejects.toThrow(/modified=0/);
  });

  it('fails postcondition on invalid/missing disable and authVersion', async () => {
    const badDisable = createInMemoryUsersCollection([
      { _id: new ObjectId(), disable: 2, authVersion: 0, disabledAt: null, disabledBy: null },
    ]);
    await expect(verifyUserDisablePostcondition(createFakeDb(badDisable))).rejects.toThrow(
      /missing\/invalid disable|invalid disable/,
    );

    const missingAuth = createInMemoryUsersCollection([
      { _id: new ObjectId(), disable: 0, disabledAt: null, disabledBy: null },
    ]);
    await expect(verifyUserDisablePostcondition(createFakeDb(missingAuth))).rejects.toThrow(
      /invalid authVersion/,
    );

    const activeWithMeta = createInMemoryUsersCollection([
      {
        _id: new ObjectId(),
        disable: 0,
        authVersion: 0,
        disabledAt: new Date('2026-07-01T00:00:00.000Z'),
        disabledBy: null,
      },
    ]);
    await expect(verifyUserDisablePostcondition(createFakeDb(activeWithMeta))).rejects.toThrow(
      /disabledAt === null|must own disabledAt/,
    );

    // Active docs must OWN disabledAt/disabledBy — missing properties fail closed.
    // Fake projection must not manufacture missing fields as null.
    const activeMissingMeta = createInMemoryUsersCollection([
      {
        _id: new ObjectId(),
        disable: 0,
        authVersion: 0,
      },
    ]);
    // Ensure the in-memory doc truly lacks the keys (no manufactured nulls).
    expect(Object.prototype.hasOwnProperty.call(activeMissingMeta.docs[0], 'disabledAt')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(activeMissingMeta.docs[0], 'disabledBy')).toBe(
      false,
    );
    await expect(verifyUserDisablePostcondition(createFakeDb(activeMissingMeta))).rejects.toThrow(
      /must own disabledAt/,
    );

    const disabledMissingDate = createInMemoryUsersCollection([
      {
        _id: new ObjectId(),
        disable: 1,
        authVersion: 1,
        disabledAt: null,
        disabledBy: new ObjectId(),
      },
    ]);
    await expect(verifyUserDisablePostcondition(createFakeDb(disabledMissingDate))).rejects.toThrow(
      /valid Date disabledAt/,
    );
  });

  it('second verification is clean/idempotent after a successful apply', async () => {
    const id = new ObjectId();
    const collection = createInMemoryUsersCollection([{ _id: id }]);
    const plan = buildUserDisableMigrationPlan(collection.docs);

    await applyUserDisableBackfill(createFakeDb(collection), plan, { batchSize: 1 });
    await expect(verifyUserDisablePostcondition(createFakeDb(collection))).resolves.toEqual({
      verified: true,
      documentCount: 1,
    });
    // Idempotent: re-verify without re-apply.
    await expect(verifyUserDisablePostcondition(createFakeDb(collection))).resolves.toEqual({
      verified: true,
      documentCount: 1,
    });

    // Zero-plan re-apply is a no-op.
    const zeroPlan = buildUserDisableMigrationPlan(collection.docs);
    expect(zeroPlan.backfillCount).toBe(0);
    await expect(
      applyUserDisableBackfill(createFakeDb(collection), zeroPlan, { batchSize: 1 }),
    ).resolves.toEqual({ modifiedDocuments: 0 });
  });
});
