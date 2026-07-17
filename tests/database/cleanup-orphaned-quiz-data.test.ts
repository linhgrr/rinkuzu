import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientSession, Db } from 'mongodb';
import { describe, expect, it } from 'vitest';

import {
  ORPHAN_QUIZ_DATA_REFERENCES,
  buildOrphanedQuizDataCheckReport,
  createOrphanedQuizDataPlanSha,
  findOrphanIds,
  getOrphanedQuizDataCheckExitCode,
  inspectOrphanedQuizData,
} from '../../scripts/cleanup-orphaned-quiz-data.mjs';

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/cleanup-orphaned-quiz-data.mjs',
);

function allRequiredCollectionNames() {
  return ['quizzes', ...ORPHAN_QUIZ_DATA_REFERENCES.map((reference) => reference.collection)];
}

function createMockSession(id: string): ClientSession {
  return Object.assign(Object.create(null), { id });
}

function createInspectMockDb(orphanIdsByCollection: Record<string, unknown[]>) {
  const listOptions: unknown[] = [];
  const aggregateCalls: Array<{ collection: string; options: unknown }> = [];

  const db: Db = Object.assign(Object.create(null), {
    listCollections: (_filter: unknown, options: unknown) => {
      listOptions.push(options);
      return {
        toArray: async () => allRequiredCollectionNames().map((name) => ({ name })),
      };
    },
    collection: (name: string) => ({
      aggregate: (_pipeline: unknown, options: unknown) => {
        aggregateCalls.push({ collection: name, options });
        const ids = orphanIdsByCollection[name] ?? [];
        return {
          map: (mapper: (document: { _id: unknown }) => unknown) => ({
            toArray: async () => ids.map((id) => mapper({ _id: id })),
          }),
        };
      },
    }),
  });

  return {
    listOptions,
    aggregateCalls,
    db,
  };
}

describe('orphaned quiz data check fingerprint', () => {
  it('creates a stable plan fingerprint regardless of collection or id order', () => {
    const first = createOrphanedQuizDataPlanSha({
      discussions: ['d', 'c'],
      attempts: ['b', 'a'],
    });
    const second = createOrphanedQuizDataPlanSha({
      attempts: ['a', 'b'],
      discussions: ['c', 'd'],
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes the plan fingerprint when orphan membership drifts', () => {
    const baseline = createOrphanedQuizDataPlanSha({
      attempts: ['a', 'b'],
      discussions: ['c'],
    });
    const drifted = createOrphanedQuizDataPlanSha({
      attempts: ['a', 'b', 'extra'],
      discussions: ['c'],
    });

    expect(drifted).not.toBe(baseline);
  });
});

describe('orphaned quiz data check report and exit semantics', () => {
  it('passes only when total orphan count is zero', async () => {
    const clean = createInspectMockDb({});
    const plan = await inspectOrphanedQuizData(clean.db);

    expect(plan.total).toBe(0);
    expect(getOrphanedQuizDataCheckExitCode(plan)).toBe(0);

    const report = buildOrphanedQuizDataCheckReport(plan, 'rinkuzu_test');
    expect(report).toEqual({
      mode: 'check',
      databaseName: 'rinkuzu_test',
      collections: Object.fromEntries(
        ORPHAN_QUIZ_DATA_REFERENCES.map((reference) => [reference.collection, 0]),
      ),
      total: 0,
      planSha: plan.planSha,
      ok: true,
    });
  });

  it('fails closed when any orphan exists', async () => {
    const dirty = createInspectMockDb({
      attempts: ['orphan-attempt-1'],
      discussions: ['orphan-discussion-1'],
    });
    const plan = await inspectOrphanedQuizData(dirty.db);

    expect(plan.total).toBe(2);
    expect(getOrphanedQuizDataCheckExitCode(plan)).toBe(1);

    const report = buildOrphanedQuizDataCheckReport(plan, 'rinkuzu_test');
    expect(report.ok).toBe(false);
    expect(report.total).toBe(2);
    expect(report.collections['attempts']).toBe(1);
    expect(report.collections['discussions']).toBe(1);
  });

  it('public report contains counts and planSha but never orphan ID lists', async () => {
    const mock = createInspectMockDb({
      attempts: ['secret-id-aaa', 'secret-id-bbb'],
      reports: ['pii-should-not-print'],
    });
    const plan = await inspectOrphanedQuizData(mock.db);
    const report = buildOrphanedQuizDataCheckReport(plan, 'rinkuzu_test');
    const serialized = JSON.stringify(report);

    expect(report.collections['attempts']).toBe(2);
    expect(report.collections['reports']).toBe(1);
    expect(report.planSha).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized).not.toContain('secret-id');
    expect(serialized).not.toContain('pii-should-not-print');
    expect(serialized).not.toContain('orphanIds');
    expect(report).not.toHaveProperty('orphanIds');
    expect(Object.keys(report).sort()).toEqual([
      'collections',
      'databaseName',
      'mode',
      'ok',
      'planSha',
      'total',
    ]);
  });
});

describe('orphaned quiz data check session propagation', () => {
  it('propagates an optional session to listCollections and aggregate', async () => {
    const session = createMockSession('txn-session');
    const mock = createInspectMockDb({});

    await inspectOrphanedQuizData(mock.db, { session });

    expect(mock.listOptions).toEqual([{ nameOnly: true, session }]);
    expect(mock.aggregateCalls).toHaveLength(ORPHAN_QUIZ_DATA_REFERENCES.length);
    for (const call of mock.aggregateCalls) {
      expect(call.options).toEqual({ session });
    }
  });

  it('omits session options when no session is provided', async () => {
    const mock = createInspectMockDb({});

    await inspectOrphanedQuizData(mock.db);

    expect(mock.listOptions).toEqual([{ nameOnly: true }]);
    for (const call of mock.aggregateCalls) {
      expect(call.options).toEqual({});
    }
  });

  it('propagates session through findOrphanIds aggregate options', async () => {
    const session = createMockSession('read-session');
    const aggregateOptions: unknown[] = [];

    const db: Db = Object.assign(Object.create(null), {
      collection: () => ({
        aggregate: (_pipeline: unknown, options: unknown) => {
          aggregateOptions.push(options);
          return {
            map: (mapper: (document: { _id: unknown }) => unknown) => ({
              toArray: async () => [mapper({ _id: 'a1' })],
            }),
          };
        },
      }),
    });

    const ids = await findOrphanIds(
      db,
      { collection: 'attempts', localField: 'quiz', foreignField: '_id' },
      { session },
    );

    expect(ids).toEqual(['a1']);
    expect(aggregateOptions).toEqual([{ session }]);
  });
});

describe('orphaned quiz data check is strictly read-only', () => {
  it('does not export destructive apply/delete helpers', async () => {
    const mod = await import('../../scripts/cleanup-orphaned-quiz-data.mjs');
    const exports = Object.keys(mod).sort();

    expect(exports).not.toContain('deleteOrphanedQuizDataRows');
    expect(exports).not.toContain('applyOrphanedQuizDataCleanup');
    expect(exports).not.toContain('validateOrphanedQuizDataCleanup');
    expect(exports).not.toContain('assertOrphanedQuizDataDeletedCounts');
    expect(exports).not.toContain('assertOrphanedQuizDataPostcondition');
    expect(exports).not.toContain('assertOrphanedQuizDataPlanMembership');

    expect(exports).toEqual(
      expect.arrayContaining([
        'ORPHAN_QUIZ_DATA_REFERENCES',
        'buildOrphanedQuizDataCheckReport',
        'createOrphanedQuizDataPlanSha',
        'findOrphanIds',
        'getOrphanedQuizDataCheckExitCode',
        'inspectOrphanedQuizData',
      ]),
    );
  });

  it('source has no deleteMany, write mutation path, or apply enablement', () => {
    const source = readFileSync(SCRIPT_PATH, 'utf8');

    expect(source).not.toMatch(/\bdeleteMany\b/);
    expect(source).not.toMatch(/\bdeleteOne\b/);
    expect(source).not.toMatch(/\bupdateMany\b/);
    expect(source).not.toMatch(/\bupdateOne\b/);
    expect(source).not.toMatch(/\binsertOne\b/);
    expect(source).not.toMatch(/\binsertMany\b/);
    expect(source).not.toMatch(/\bwithTransaction\b/);
    expect(source).not.toMatch(/--apply/);
    expect(source).not.toMatch(/approve-plan/);
    expect(source).not.toMatch(/max-delete/);
    expect(source).toMatch(/Strictly read-only reconciliation/);
  });

  it('CLI destructive flags cannot change check mode or enable mutation', async () => {
    const previousArgv = process.argv.slice();
    try {
      process.argv = [
        previousArgv[0] ?? 'node',
        SCRIPT_PATH,
        '--apply',
        '--approve-plan=deadbeef',
        '--max-delete=1',
      ];

      const mod = await import('../../scripts/cleanup-orphaned-quiz-data.mjs');
      const mock = createInspectMockDb({ attempts: ['still-an-orphan'] });
      const plan = await mod.inspectOrphanedQuizData(mock.db);
      const report = mod.buildOrphanedQuizDataCheckReport(plan, 'rinkuzu_test');

      // Even with destructive argv present, the public surface remains a check report.
      expect(report.mode).toBe('check');
      expect(report.ok).toBe(false);
      expect(mod.getOrphanedQuizDataCheckExitCode(plan)).toBe(1);
      expect(
        typeof (mod as { applyOrphanedQuizDataCleanup?: unknown }).applyOrphanedQuizDataCleanup,
      ).toBe('undefined');
      expect(
        typeof (mod as { deleteOrphanedQuizDataRows?: unknown }).deleteOrphanedQuizDataRows,
      ).toBe('undefined');
    } finally {
      process.argv = previousArgv;
    }
  });
});
