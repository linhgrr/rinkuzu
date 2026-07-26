import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import {
  applyFirstPurchaseEligibilityMigration,
  buildFirstPurchaseEligibilityMigrationPlan,
  buildFirstPurchaseEligibilityTargets,
  inspectFirstPurchaseEligibilityMigration,
  validateFirstPurchaseEligibilityMigrationApproval,
  validateFirstPurchaseEligibilityMigrationModes,
  verifyFirstPurchaseEligibilityPostcondition,
} from '../../scripts/migrate-first-purchase-eligibility.mjs';

type ClaimStatus = 'reserved' | 'consumed' | 'released' | 'late_consumed';

function claim(
  overrides: Partial<{
    _id: ObjectId;
    user: ObjectId;
    order: ObjectId;
    eligibilityClass: string;
    status: ClaimStatus;
    reservedAt: Date;
    consumedAt: Date;
    releasedAt: Date;
  }> = {},
) {
  return {
    _id: new ObjectId(),
    user: new ObjectId(),
    order: new ObjectId(),
    eligibilityClass: 'first_purchase',
    status: 'released' as ClaimStatus,
    reservedAt: new Date('2026-07-20T00:00:00.000Z'),
    releasedAt: new Date('2026-07-20T00:10:00.000Z'),
    ...overrides,
  };
}

const idIndex = { name: '_id_', key: { _id: 1 }, unique: true };
const legacyClaimUserIndex = {
  name: 'user_1_eligibilityClass_1',
  key: { user: 1, eligibilityClass: 1 },
  unique: true,
};
const desiredClaimUserIndex = {
  name: 'first_purchase_claim_active_user_class_unique',
  key: { user: 1, eligibilityClass: 1 },
  unique: true,
  partialFilterExpression: { status: 'reserved' },
};
const claimOrderIndex = {
  name: 'first_purchase_claim_order_unique',
  key: { order: 1 },
  unique: true,
};
const eligibilityUserIndex = {
  name: 'first_purchase_eligibility_user_class_unique',
  key: { user: 1, eligibilityClass: 1 },
  unique: true,
};

function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value) as T;
  if (value instanceof ObjectId) return new ObjectId(value) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, clone(nested)]),
    ) as T;
  }
  return value;
}

function matches(document: Record<string, unknown>, filter: Record<string, unknown>) {
  return Object.entries(filter).every(([field, expected]) => {
    const actual = document[field];
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return (expected.$in as unknown[]).includes(actual);
    }
    return String(actual) === String(expected);
  });
}

function createFakeDb(options: {
  claims?: Array<Record<string, unknown>>;
  eligibilities?: Array<Record<string, unknown>>;
  claimIndexes?: Array<Record<string, unknown>>;
  eligibilityIndexes?: Array<Record<string, unknown>>;
}) {
  const claims = (options.claims ?? []).map(clone);
  const eligibilities = (options.eligibilities ?? []).map(clone);
  const indexes: Record<string, Array<Record<string, unknown>>> = {
    firstpurchaseclaims: (options.claimIndexes ?? [idIndex]).map(
      (entry) => clone(entry) as Record<string, unknown>,
    ),
    firstpurchaseeligibilities: (options.eligibilityIndexes ?? [idIndex]).map(
      (entry) => clone(entry) as Record<string, unknown>,
    ),
  };

  function collection(name: 'firstpurchaseclaims' | 'firstpurchaseeligibilities') {
    const documents = name === 'firstpurchaseclaims' ? claims : eligibilities;
    return {
      find(filter: Record<string, unknown>) {
        return {
          async toArray() {
            return documents.filter((document) => matches(document, filter)).map(clone);
          },
        };
      },
      async findOne(filter: Record<string, unknown>) {
        return clone(documents.find((document) => matches(document, filter)) ?? null);
      },
      async insertOne(document: Record<string, unknown>) {
        if (
          name === 'firstpurchaseeligibilities' &&
          documents.some(
            (entry) =>
              String(entry['user']) === String(document['user']) &&
              entry['eligibilityClass'] === document['eligibilityClass'],
          )
        ) {
          throw Object.assign(new Error('duplicate'), { code: 11000 });
        }
        documents.push(clone({ _id: new ObjectId(), ...document }));
        return { acknowledged: true, insertedId: documents.at(-1)?.['_id'] };
      },
      listIndexes() {
        return {
          async toArray() {
            return indexes[name].map(clone);
          },
        };
      },
      async createIndex(key: Record<string, number>, createOptions: Record<string, unknown>) {
        const indexName =
          typeof createOptions['name'] === 'string'
            ? createOptions['name']
            : Object.entries(key)
                .map(([field, direction]) => `${field}_${direction}`)
                .join('_');
        indexes[name].push({
          name: indexName,
          key: clone(key),
          ...(createOptions['unique'] === true ? { unique: true } : {}),
          ...(createOptions['partialFilterExpression']
            ? { partialFilterExpression: clone(createOptions['partialFilterExpression']) }
            : {}),
        });
        return indexName;
      },
      async dropIndex(indexName: string) {
        const index = indexes[name].findIndex((entry) => entry['name'] === indexName);
        if (index < 0) throw new Error(`missing index ${indexName}`);
        indexes[name].splice(index, 1);
      },
    };
  }

  return {
    listCollections(filter: { name?: string }) {
      return {
        async toArray() {
          return filter.name &&
            filter.name !== 'firstpurchaseclaims' &&
            filter.name !== 'firstpurchaseeligibilities'
            ? []
            : [{ name: filter.name }];
        },
      };
    },
    collection,
    claims,
    eligibilities,
    indexes,
  };
}

describe('first-purchase eligibility derivation', () => {
  it('chooses consumed deterministically, otherwise reserved or available', () => {
    const consumedUser = new ObjectId();
    const later = claim({
      user: consumedUser,
      status: 'consumed',
      consumedAt: new Date('2026-07-20T00:04:00.000Z'),
      releasedAt: undefined,
    });
    const earlier = claim({
      user: consumedUser,
      status: 'late_consumed',
      consumedAt: new Date('2026-07-20T00:03:00.000Z'),
      releasedAt: undefined,
    });
    const reservedUser = new ObjectId();
    const reserved = claim({
      user: reservedUser,
      status: 'reserved',
      releasedAt: undefined,
    });
    const releasedUser = new ObjectId();
    const released = claim({ user: releasedUser });

    const targets = buildFirstPurchaseEligibilityTargets([later, reserved, released, earlier], []);
    const consumedTarget = targets.find((target) => target.userKey === consumedUser.toHexString());
    const reservedTarget = targets.find((target) => target.userKey === reservedUser.toHexString());
    const availableTarget = targets.find((target) => target.userKey === releasedUser.toHexString());

    expect(consumedTarget?.desired).toMatchObject({
      status: 'consumed',
      activeOrder: earlier.order,
      consumedAt: earlier.consumedAt,
    });
    expect(reservedTarget?.desired).toMatchObject({
      status: 'reserved',
      activeOrder: reserved.order,
      reservedAt: reserved.reservedAt,
    });
    expect(availableTarget?.desired).toMatchObject({ status: 'available' });
    expect(availableTarget?.desired).not.toHaveProperty('activeOrder');
  });

  it('fails closed on multiple active reservations or conflicting singleton state', () => {
    const user = new ObjectId();
    expect(() =>
      buildFirstPurchaseEligibilityTargets(
        [
          claim({ user, status: 'reserved', releasedAt: undefined }),
          claim({ user, status: 'reserved', releasedAt: undefined }),
        ],
        [],
      ),
    ).toThrow(/2 active first-purchase reservations/);

    const released = claim({ user });
    expect(() =>
      buildFirstPurchaseEligibilityTargets(
        [released],
        [
          {
            user,
            eligibilityClass: 'first_purchase',
            status: 'consumed',
            activeOrder: released.order,
            consumedAt: new Date(),
            version: 1,
          },
        ],
      ),
    ).toThrow(/conflicts with claim history/);
  });

  it('is deterministic regardless of claim input order', () => {
    const user = new ObjectId();
    const a = claim({ user });
    const b = claim({
      user,
      reservedAt: new Date('2026-07-21T00:00:00.000Z'),
      releasedAt: new Date('2026-07-21T00:10:00.000Z'),
    });
    const first = buildFirstPurchaseEligibilityMigrationPlan({
      claims: [a, b],
      eligibilities: [],
      claimIndexes: [idIndex, legacyClaimUserIndex],
      eligibilityIndexes: [idIndex],
    });
    const second = buildFirstPurchaseEligibilityMigrationPlan({
      claims: [b, a],
      eligibilities: [],
      claimIndexes: [legacyClaimUserIndex, idIndex],
      eligibilityIndexes: [idIndex],
    });
    expect(first.planSha).toBe(second.planSha);
    expect(first.actions).toEqual({
      backfillSingletons: 1,
      claimUserClass: 'replace',
      claimOrder: 'create',
      eligibilityUserClass: 'create',
    });
  });
});

describe('first-purchase eligibility migration safety', () => {
  it('requires exact plan approval and explicit billing-create confirmation', () => {
    expect(() =>
      validateFirstPurchaseEligibilityMigrationModes({
        apply: true,
        verifyOnly: false,
        approvedPlanSha: 'abc',
        billingCreateDisabledConfirmed: false,
      }),
    ).toThrow(/confirm-billing-create-disabled/);
    expect(() =>
      validateFirstPurchaseEligibilityMigrationModes({
        apply: true,
        verifyOnly: true,
        approvedPlanSha: 'abc',
        billingCreateDisabledConfirmed: true,
      }),
    ).toThrow(/cannot be combined/);

    const plan = { planSha: 'expected' };
    expect(() =>
      validateFirstPurchaseEligibilityMigrationApproval({
        apply: true,
        approvedPlanSha: 'wrong',
        plan,
      }),
    ).toThrow(/mismatch/);
    expect(() =>
      validateFirstPurchaseEligibilityMigrationApproval({
        apply: true,
        approvedPlanSha: 'expected',
        plan,
      }),
    ).not.toThrow();
  });

  it('backfills singleton, replaces legacy index, creates required indexes and verifies', async () => {
    const released = claim();
    const db = createFakeDb({
      claims: [released],
      claimIndexes: [idIndex, legacyClaimUserIndex],
      eligibilityIndexes: [idIndex],
    });
    const plan = await inspectFirstPurchaseEligibilityMigration(db);
    expect(plan.actions).toEqual({
      backfillSingletons: 1,
      claimUserClass: 'replace',
      claimOrder: 'create',
      eligibilityUserClass: 'create',
    });

    await expect(applyFirstPurchaseEligibilityMigration(db, plan)).resolves.toEqual({
      insertedSingletons: 1,
    });
    expect(db.eligibilities).toEqual([
      expect.objectContaining({
        user: released.user,
        eligibilityClass: 'first_purchase',
        status: 'available',
        version: 0,
      }),
    ]);
    expect(db.indexes['firstpurchaseclaims']).toEqual(
      expect.arrayContaining([
        expect.objectContaining(claimOrderIndex),
        expect.objectContaining(desiredClaimUserIndex),
      ]),
    );
    expect(db.indexes['firstpurchaseclaims']).not.toEqual(
      expect.arrayContaining([expect.objectContaining(legacyClaimUserIndex)]),
    );
    expect(db.indexes['firstpurchaseeligibilities']).toEqual(
      expect.arrayContaining([expect.objectContaining(eligibilityUserIndex)]),
    );
    await expect(verifyFirstPurchaseEligibilityPostcondition(db)).resolves.toMatchObject({
      verified: true,
      claimCount: 1,
      eligibilityCount: 1,
      userCount: 1,
    });
  });

  it('verify fails while backfill or index replacement remains pending', async () => {
    const db = createFakeDb({
      claims: [claim()],
      claimIndexes: [idIndex, legacyClaimUserIndex],
      eligibilityIndexes: [idIndex],
    });
    await expect(verifyFirstPurchaseEligibilityPostcondition(db)).rejects.toThrow(
      /pending actions/,
    );
  });

  it('recognizes an already migrated database as a no-op plan', async () => {
    const released = claim();
    const db = createFakeDb({
      claims: [released],
      eligibilities: [
        {
          _id: new ObjectId(),
          user: released.user,
          eligibilityClass: 'first_purchase',
          status: 'available',
          version: 2,
        },
      ],
      claimIndexes: [idIndex, desiredClaimUserIndex, claimOrderIndex],
      eligibilityIndexes: [idIndex, eligibilityUserIndex],
    });
    const plan = await inspectFirstPurchaseEligibilityMigration(db);
    expect(plan.actions).toEqual({
      backfillSingletons: 0,
      claimUserClass: 'noop',
      claimOrder: 'noop',
      eligibilityUserClass: 'noop',
    });
  });
});
