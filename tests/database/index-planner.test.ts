import { describe, expect, it } from 'vitest';

import {
  buildIndexPlan,
  canonicalizeIndexOptions,
  validateIndexContract,
} from '../../scripts/database/index-planner.mjs';

const BASE = {
  contractVersion: 'test.1',
  databaseName: 'rinkuzu-test',
};

describe('database index planner', () => {
  it('treats server defaults and non-contractual names semantically', () => {
    const contract = [
      {
        id: 'users.email',
        collection: 'users',
        key: { email: 1 },
        options: { unique: true },
        lifecycle: 'required_active',
      },
    ];
    const plan = makePlan(contract, {
      users: [{ name: 'server_generated_name', key: { email: 1 }, unique: true, v: 2 }],
    });

    expect(plan).toMatchObject({ status: 'clean', blockingCount: 0, manualCount: 0 });
  });

  it('normalizes expanded collation defaults', () => {
    expect(canonicalizeIndexOptions({ collation: { locale: 'en' } })).toEqual(
      canonicalizeIndexOptions({
        collation: {
          locale: 'en',
          caseLevel: false,
          caseFirst: 'off',
          strength: 3,
          numericOrdering: false,
          alternate: 'non-ignorable',
          maxVariable: 'punct',
          normalization: false,
          backwards: false,
          version: '57.1',
        },
      }),
    );
  });

  it('blocks option mismatches without proposing a destructive rebuild', () => {
    const contract = [required('discussions.unique', 'discussions', { quiz: 1 }, { unique: true })];
    const plan = makePlan(contract, {
      discussions: [{ name: 'quiz_1', key: { quiz: 1 }, unique: false }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        type: 'manual',
        code: 'options_mismatch',
        indexId: 'discussions.unique',
      }),
    ]);
    expect(plan.actions.map((action: { type: string }) => action.type)).not.toContain('drop');
    expect(plan.actions.map((action: { type: string }) => action.type)).not.toContain('create');
  });

  it('marks missing unique and TTL indexes as sensitive', () => {
    const contract = [
      required('users.email', 'users', { email: 1 }, { unique: true }),
      required('audit.retention', 'auditlogs', { createdAt: 1 }, { expireAfterSeconds: 60 }),
    ];
    const plan = makePlan(contract, { users: [], auditlogs: [] });

    expect(plan.sensitiveCount).toBe(2);
    expect(plan.actions).toEqual([
      expect.objectContaining({ sensitive: true, type: 'create' }),
      expect.objectContaining({ sensitive: true, type: 'create' }),
    ]);
  });

  it('updates single-field TTL drift with a sensitive collMod action', () => {
    const contract = [
      required('audit.retention', 'auditlogs', { createdAt: 1 }, { expireAfterSeconds: 60 }),
    ];
    const plan = makePlan(contract, {
      auditlogs: [{ name: 'createdAt_1', key: { createdAt: 1 } }],
    });

    expect(plan).toMatchObject({ manualCount: 0, sensitiveCount: 1 });
    expect(plan.actions).toEqual([
      expect.objectContaining({
        type: 'update_ttl',
        actualName: 'createdAt_1',
        options: { expireAfterSeconds: 60 },
        sensitive: true,
      }),
    ]);
  });

  it('rejects TTL values outside the MongoDB server range', () => {
    const contract = [
      required(
        'audit.retention',
        'auditlogs',
        { createdAt: 1 },
        { expireAfterSeconds: 2_147_483_648 },
      ),
    ];

    expect(validateIndexContract(contract)).toEqual([
      expect.objectContaining({ code: 'invalid_ttl', indexId: 'audit.retention' }),
    ]);
  });

  it('hides deprecated indexes and never drops without lifecycle evidence', () => {
    const contract = [deprecated('quizzes.old', 'quizzes', { status: 1 })];
    const visible = makePlan(contract, {
      quizzes: [{ name: 'status_1', key: { status: 1 } }],
    });
    const hidden = makePlan(contract, {
      quizzes: [{ name: 'status_1', key: { status: 1 }, hidden: true }],
    });

    expect(visible.actions).toEqual([expect.objectContaining({ type: 'hide', sensitive: false })]);
    expect(hidden).toMatchObject({ status: 'clean', blockingCount: 0 });
  });

  it('allows a sensitive drop only after seven days and a completed workload cycle', () => {
    const contract = [
      {
        ...deprecated('quizzes.old', 'quizzes', { status: 1 }),
        hiddenSince: '2026-07-01T00:00:00.000Z',
        dropAfter: '2026-07-08T00:00:00.000Z',
        workloadCycleEvidence: {
          reference: 'APM-142',
          observedAt: '2026-07-07T00:00:00.000Z',
        },
      },
    ];
    const actual = { quizzes: [{ name: 'status_1', key: { status: 1 }, hidden: true }] };

    expect(makePlan(contract, actual, new Date('2026-07-07T23:59:59.000Z')).actions).toEqual([]);
    expect(makePlan(contract, actual, new Date('2026-07-09T00:00:00.000Z')).actions).toEqual([
      expect.objectContaining({ type: 'drop', sensitive: true }),
    ]);
  });

  it('rejects invalid sparse plus partial index definitions', () => {
    const contract = [
      required(
        'users.token',
        'users',
        { token: 1 },
        { sparse: true, partialFilterExpression: { token: { $type: 'string' } } },
      ),
    ];

    expect(validateIndexContract(contract)).toEqual([
      expect.objectContaining({ code: 'sparse_partial_conflict', indexId: 'users.token' }),
    ]);
    expect(makePlan(contract, { users: [] }).manualCount).toBe(1);
  });

  it('blocks unclassified server indexes but permits the implicit _id index', () => {
    const plan = makePlan([], {
      users: [
        { name: '_id_', key: { _id: 1 } },
        { name: 'rogue_1', key: { rogue: 1 } },
      ],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({ code: 'unauthorized_index', actualName: 'rogue_1' }),
    ]);
  });

  it('produces the same plan SHA for reordered server index arrays', () => {
    const contract = [
      required('users.email', 'users', { email: 1 }, { unique: true }),
      required('users.recent', 'users', { createdAt: -1 }),
    ];
    const email = { name: 'email_1', key: { email: 1 }, unique: true };
    const recent = { name: 'createdAt_-1', key: { createdAt: -1 } };

    expect(makePlan(contract, { users: [email, recent] }).planSha).toBe(
      makePlan(contract, { users: [recent, email] }).planSha,
    );
  });
});

function makePlan(
  contract: Array<Record<string, unknown>>,
  actualIndexesByCollection: Record<string, Array<Record<string, unknown>>>,
  now = new Date('2026-07-15T00:00:00.000Z'),
) {
  return buildIndexPlan({ ...BASE, contract, actualIndexesByCollection, now });
}

function required(
  id: string,
  collection: string,
  key: Record<string, number>,
  options: Record<string, unknown> = {},
) {
  return { id, collection, key, options, lifecycle: 'required_active' };
}

function deprecated(id: string, collection: string, key: Record<string, number>) {
  return { id, collection, key, options: {}, lifecycle: 'deprecated_hidden' };
}
