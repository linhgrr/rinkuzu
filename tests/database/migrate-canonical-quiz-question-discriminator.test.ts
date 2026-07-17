import type { ClientSession, Db, MongoClient } from 'mongodb';
import { describe, expect, it } from 'vitest';

import {
  applyCanonicalDiscriminatorMigration,
  assertCanonicalDiscriminatorCollectionPrerequisites,
  assertCanonicalDiscriminatorPostcondition,
  assertCanonicalDiscriminatorTotalModified,
  assertCanonicalDiscriminatorWriteResult,
  buildCanonicalDiscriminatorInspection,
  buildConditionalUnsetFilter,
  buildUnsetSpec,
  createCanonicalDiscriminatorPlanSha,
  discoverCanonicalDiscriminatorCollectionPrerequisites,
  inspectCanonicalDiscriminatorMigration,
  inspectQuestionElement,
  inspectQuestionsArray,
  isEmptyArray,
  isNonNegativeInteger,
  normalizeCanonicalDiscriminatorTargets,
  validateCanonicalDiscriminatorMigration,
} from '../../scripts/migrate-canonical-quiz-question-discriminator.mjs';

function plan(
  overrides: {
    totalAffectedDocuments?: number;
    totalAffectedQuestions?: number;
    planSha?: string;
  } = {},
) {
  return {
    totalAffectedDocuments: overrides.totalAffectedDocuments ?? 2,
    totalAffectedQuestions: overrides.totalAffectedQuestions ?? 5,
    planSha: overrides.planSha ?? 'approved-sha',
  };
}

function legacySingle(index = 0) {
  return {
    type: 'single' as const,
    options: ['A', 'B'],
    correctIndex: index,
    correctIndexes: [] as number[],
  };
}

describe('canonical quiz question discriminator migration', () => {
  describe('element classification', () => {
    it('accepts clean canonical single and multiple questions', () => {
      expect(
        inspectQuestionElement({ type: 'single', options: ['A', 'B'], correctIndex: 0 }, 0),
      ).toEqual({ kind: 'clean', index: 0 });

      expect(
        inspectQuestionElement(
          { type: 'multiple', options: ['A', 'B', 'C'], correctIndexes: [0, 2] },
          1,
        ),
      ).toEqual({ kind: 'clean', index: 1 });
    });

    it('flags only legacy single with exact empty correctIndexes as migratable', () => {
      expect(isEmptyArray([])).toBe(true);
      expect(isEmptyArray([0])).toBe(false);
      expect(isNonNegativeInteger(0)).toBe(true);
      expect(isNonNegativeInteger(-1)).toBe(false);
      expect(isNonNegativeInteger(1.5)).toBe(false);
      expect(isNonNegativeInteger('0')).toBe(false);

      expect(
        inspectQuestionElement(
          {
            type: 'single',
            options: ['A', 'B'],
            correctIndex: 1,
            correctIndexes: [],
          },
          3,
        ),
      ).toEqual({ kind: 'legacy-empty-opposite', index: 3 });

      expect(
        inspectQuestionElement(
          {
            type: 'single',
            options: ['A', 'B'],
            correctIndex: 1,
            correctIndexes: [0],
          },
          0,
        ),
      ).toMatchObject({
        kind: 'unsafe',
        reason: 'single nonempty opposite correctIndexes',
      });
    });

    it('rejects missing/unknown type, invalid keys, and multiple+correctIndex', () => {
      expect(inspectQuestionElement({ options: ['A', 'B'], correctIndex: 0 }, 0)).toMatchObject({
        kind: 'unsafe',
        reason: 'missing type',
      });

      expect(
        inspectQuestionElement({ type: 'boolean', options: ['A', 'B'], correctIndex: 0 }, 0),
      ).toMatchObject({ kind: 'unsafe', reason: 'unknown type: boolean' });

      expect(
        inspectQuestionElement({ type: 'single', options: ['A', 'B'], correctIndexes: [] }, 0),
      ).toMatchObject({ kind: 'unsafe', reason: 'single question missing correctIndex' });

      expect(
        inspectQuestionElement({ type: 'single', options: ['A', 'B'], correctIndex: 1.5 }, 0),
      ).toMatchObject({ kind: 'unsafe', reason: 'single question has invalid correctIndex' });

      expect(
        inspectQuestionElement(
          {
            type: 'multiple',
            options: ['A', 'B'],
            correctIndexes: [0],
            correctIndex: 0,
          },
          0,
        ),
      ).toMatchObject({ kind: 'unsafe', reason: 'multiple has correctIndex' });

      expect(
        inspectQuestionElement({ type: 'multiple', options: ['A', 'B'], correctIndexes: [] }, 0),
      ).toMatchObject({ kind: 'unsafe', reason: 'multiple question has empty correctIndexes' });
    });

    it('marks missing/null/non-array questions as unsafe, not silently clean', () => {
      expect(inspectQuestionsArray(undefined).unsafe).toEqual([
        expect.objectContaining({ kind: 'unsafe', reason: 'questions is missing or null' }),
      ]);
      expect(inspectQuestionsArray(null).unsafe).toEqual([
        expect.objectContaining({ kind: 'unsafe', reason: 'questions is missing or null' }),
      ]);
      expect(inspectQuestionsArray({ not: 'array' }).unsafe).toEqual([
        expect.objectContaining({ kind: 'unsafe', reason: 'questions is not an array' }),
      ]);
      expect(inspectQuestionsArray(undefined).affectedIndexes).toEqual([]);
      expect(inspectQuestionsArray(null).elementCount).toBe(0);
    });

    it('marks missing/null/non-array and too-short options as unsafe with range checks', () => {
      expect(
        inspectQuestionElement({ type: 'single', correctIndex: 0, correctIndexes: [] }, 0),
      ).toMatchObject({ kind: 'unsafe', reason: 'single question missing or invalid options' });

      expect(
        inspectQuestionElement(
          { type: 'single', options: null, correctIndex: 0, correctIndexes: [] },
          0,
        ),
      ).toMatchObject({ kind: 'unsafe', reason: 'single question missing or invalid options' });

      expect(
        inspectQuestionElement(
          { type: 'single', options: 'A,B', correctIndex: 0, correctIndexes: [] },
          0,
        ),
      ).toMatchObject({ kind: 'unsafe', reason: 'single question missing or invalid options' });

      expect(
        inspectQuestionElement(
          { type: 'single', options: ['A'], correctIndex: 1, correctIndexes: [] },
          0,
        ),
      ).toMatchObject({
        kind: 'unsafe',
        reason: 'single question correctIndex out of options range',
      });

      expect(inspectQuestionElement({ type: 'multiple', correctIndexes: [0] }, 0)).toMatchObject({
        kind: 'unsafe',
        reason: 'multiple question missing or invalid options',
      });

      expect(
        inspectQuestionElement({ type: 'multiple', options: ['A'], correctIndexes: [1] }, 0),
      ).toMatchObject({
        kind: 'unsafe',
        reason: 'multiple question correctIndexes out of options range',
      });
    });

    it('aggregates affected indexes and unsafe findings for a questions array', () => {
      const scan = inspectQuestionsArray([
        { type: 'single', options: ['A', 'B'], correctIndex: 0, correctIndexes: [] },
        { type: 'single', options: ['A', 'B'], correctIndex: 1 },
        { type: 'multiple', options: ['A', 'B'], correctIndexes: [0], correctIndex: 1 },
      ]);

      expect(scan.elementCount).toBe(3);
      expect(scan.affectedIndexes).toEqual([0]);
      expect(scan.unsafe).toHaveLength(1);
      expect(scan.unsafe[0]?.reason).toBe('multiple has correctIndex');
    });
  });

  describe('plan fingerprint and apply guards', () => {
    it('creates a stable plan fingerprint regardless of document id order', () => {
      const first = createCanonicalDiscriminatorPlanSha({
        quizTargets: [
          { id: 'b', affectedIndexes: [1] },
          { id: 'a', affectedIndexes: [0, 2] },
        ],
        attemptTargets: [
          { id: 'd', affectedIndexes: [0] },
          { id: 'c', affectedIndexes: [3] },
        ],
      });
      const second = createCanonicalDiscriminatorPlanSha({
        quizTargets: [
          { id: 'a', affectedIndexes: [2, 0] },
          { id: 'b', affectedIndexes: [1] },
        ],
        attemptTargets: [
          { id: 'c', affectedIndexes: [3] },
          { id: 'd', affectedIndexes: [0] },
        ],
      });

      expect(first).toBe(second);
      expect(first).toMatch(/^[a-f0-9]{64}$/);
    });

    it('changes the plan fingerprint when affectedIndexes or distribution differ', () => {
      const base = createCanonicalDiscriminatorPlanSha({
        quizTargets: [{ id: 'a', affectedIndexes: [0, 1] }],
        attemptTargets: [],
      });
      const differentIndexes = createCanonicalDiscriminatorPlanSha({
        quizTargets: [{ id: 'a', affectedIndexes: [0, 2] }],
        attemptTargets: [],
      });
      const sameCountDifferentDocs = createCanonicalDiscriminatorPlanSha({
        quizTargets: [
          { id: 'a', affectedIndexes: [0] },
          { id: 'b', affectedIndexes: [0] },
        ],
        attemptTargets: [],
      });
      const sameIdsDifferentDistribution = createCanonicalDiscriminatorPlanSha({
        quizTargets: [
          { id: 'a', affectedIndexes: [0, 1] },
          { id: 'b', affectedIndexes: [] },
        ].filter((t) => t.affectedIndexes.length > 0),
        attemptTargets: [],
      });

      expect(base).not.toBe(differentIndexes);
      expect(base).not.toBe(sameCountDifferentDocs);
      // Same total question count (2) on one doc vs split would require two docs with one each
      const twoDocsOneEach = createCanonicalDiscriminatorPlanSha({
        quizTargets: [
          { id: 'a', affectedIndexes: [0] },
          { id: 'b', affectedIndexes: [1] },
        ],
        attemptTargets: [],
      });
      expect(base).not.toBe(twoDocsOneEach);
      expect(sameIdsDifferentDistribution).toBe(
        createCanonicalDiscriminatorPlanSha({
          quizTargets: [{ id: 'a', affectedIndexes: [0, 1] }],
          attemptTargets: [],
        }),
      );

      const normalized = normalizeCanonicalDiscriminatorTargets([
        { id: 'z', affectedIndexes: [2, 0] },
        { id: 'a', affectedIndexes: [1] },
      ]);
      expect(normalized).toEqual([
        { id: 'a', affectedIndexes: [1] },
        { id: 'z', affectedIndexes: [0, 2] },
      ]);
    });

    it('requires an exact approved plan before applying writes', () => {
      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: true,
          maxDocuments: 100,
          plan: plan(),
        }),
      ).toThrow('Apply requires --approve-plan=approved-sha');

      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: true,
          approvedPlanSha: 'stale-sha',
          maxDocuments: 100,
          plan: plan(),
        }),
      ).toThrow('Approved plan SHA does not match');
    });

    it('enforces the document ceiling but permits an idempotent empty apply', () => {
      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: true,
          approvedPlanSha: 'approved-sha',
          maxDocuments: 1,
          plan: plan({ totalAffectedDocuments: 2 }),
        }),
      ).toThrow('above the --max-documents limit');

      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: false,
          maxDocuments: 1,
          plan: plan({ totalAffectedDocuments: 99 }),
        }),
      ).not.toThrow();

      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: true,
          maxDocuments: 100,
          plan: plan({ totalAffectedDocuments: 0, totalAffectedQuestions: 0 }),
        }),
      ).not.toThrow();
    });

    it('rejects non-positive or non-safe-integer max-documents', () => {
      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: false,
          maxDocuments: 0,
          plan: plan({ totalAffectedDocuments: 0 }),
        }),
      ).toThrow('--max-documents must be a positive safe integer');

      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: false,
          maxDocuments: 1.5,
          plan: plan({ totalAffectedDocuments: 0 }),
        }),
      ).toThrow('--max-documents must be a positive safe integer');

      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: false,
          maxDocuments: Number.MAX_SAFE_INTEGER + 1,
          plan: plan({ totalAffectedDocuments: 0 }),
        }),
      ).toThrow('--max-documents must be a positive safe integer');
    });

    it('rejects transaction-plan SHA drift against the approved fingerprint', () => {
      const approved = createCanonicalDiscriminatorPlanSha({
        quizTargets: [{ id: 'quiz-1', affectedIndexes: [0] }],
        attemptTargets: [],
      });
      const drifted = createCanonicalDiscriminatorPlanSha({
        quizTargets: [{ id: 'quiz-1', affectedIndexes: [0, 1] }],
        attemptTargets: [],
      });
      expect(approved).not.toBe(drifted);

      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: true,
          approvedPlanSha: approved,
          maxDocuments: 10,
          plan: {
            planSha: drifted,
            totalAffectedDocuments: 1,
            totalAffectedQuestions: 2,
          },
        }),
      ).toThrow('Approved plan SHA does not match the current migration plan');

      expect(() =>
        validateCanonicalDiscriminatorMigration({
          apply: true,
          approvedPlanSha: approved,
          maxDocuments: 10,
          plan: {
            planSha: approved,
            totalAffectedDocuments: 1,
            totalAffectedQuestions: 1,
          },
        }),
      ).not.toThrow();
    });
  });

  describe('conditional filters and write count guards', () => {
    it('builds exact conditional filters reasserting type and empty correctIndexes paths', () => {
      expect(buildConditionalUnsetFilter('questions', 'quiz-1', [0, 2])).toEqual({
        _id: 'quiz-1',
        'questions.0.type': 'single',
        'questions.0.correctIndexes': [],
        'questions.2.type': 'single',
        'questions.2.correctIndexes': [],
      });

      expect(buildConditionalUnsetFilter('quizSnapshot.questions', 'attempt-9', [1])).toEqual({
        _id: 'attempt-9',
        'quizSnapshot.questions.1.type': 'single',
        'quizSnapshot.questions.1.correctIndexes': [],
      });

      // Never _id-only when indexes are present
      const filter = buildConditionalUnsetFilter('questions', 'x', [0]);
      expect(Object.keys(filter).sort()).toEqual([
        '_id',
        'questions.0.correctIndexes',
        'questions.0.type',
      ]);
      expect(filter['questions.0.correctIndexes']).toEqual([]);
    });

    it('rejects matched/modified undercount and total modified drift', () => {
      expect(() =>
        assertCanonicalDiscriminatorWriteResult({
          matchedCount: 1,
          modifiedCount: 1,
          source: 'Quiz',
          targetId: 'ok',
        }),
      ).not.toThrow();

      expect(() =>
        assertCanonicalDiscriminatorWriteResult({
          matchedCount: 0,
          modifiedCount: 0,
          source: 'Quiz',
          targetId: 'missing',
        }),
      ).toThrow('Quiz missing expected matchedCount=1 and modifiedCount=1');

      expect(() =>
        assertCanonicalDiscriminatorWriteResult({
          matchedCount: 1,
          modifiedCount: 0,
          source: 'Attempt',
          targetId: 'noop',
        }),
      ).toThrow(
        'Attempt noop expected matchedCount=1 and modifiedCount=1, got matched=1 modified=0',
      );

      expect(() => assertCanonicalDiscriminatorTotalModified(2, 2)).not.toThrow();
      expect(() => assertCanonicalDiscriminatorTotalModified(1, 2)).toThrow(
        'Modified 1 documents but plan targeted 2',
      );
    });
  });

  describe('inspection assembly and postcondition', () => {
    it('builds a plan for safe legacy empty opposites and fails closed on unsafe shapes', () => {
      const safe = buildCanonicalDiscriminatorInspection({
        quizzes: [
          {
            _id: 'quiz-1',
            questions: [
              {
                type: 'single',
                options: ['A', 'B'],
                correctIndex: 0,
                correctIndexes: [],
              },
              { type: 'single', options: ['A', 'B'], correctIndex: 1 },
            ],
          },
        ],
        attempts: [
          {
            _id: 'attempt-1',
            quizSnapshot: {
              questions: [
                {
                  type: 'single',
                  options: ['X', 'Y'],
                  correctIndex: 0,
                  correctIndexes: [],
                },
              ],
            },
          },
        ],
      });

      expect(safe.quizDocumentCount).toBe(1);
      expect(safe.attemptDocumentCount).toBe(1);
      expect(safe.quizQuestionCount).toBe(2);
      expect(safe.attemptQuestionCount).toBe(1);
      expect(safe.quizAffectedQuestionCount).toBe(1);
      expect(safe.attemptAffectedQuestionCount).toBe(1);
      expect(safe.totalAffectedDocuments).toBe(2);
      expect(safe.totalAffectedQuestions).toBe(2);
      expect(safe.quizTargets[0]?.affectedIndexes).toEqual([0]);
      expect(safe.attemptTargets[0]?.affectedIndexes).toEqual([0]);
      expect(safe.planSha).toBe(
        createCanonicalDiscriminatorPlanSha({
          quizTargets: [{ id: 'quiz-1', affectedIndexes: [0] }],
          attemptTargets: [{ id: 'attempt-1', affectedIndexes: [0] }],
        }),
      );

      expect(() =>
        buildCanonicalDiscriminatorInspection({
          quizzes: [
            {
              _id: 'quiz-bad',
              questions: [
                {
                  type: 'single',
                  options: ['A', 'B'],
                  correctIndex: 0,
                  correctIndexes: [1],
                },
              ],
            },
          ],
          attempts: [],
        }),
      ).toThrow(/Unsafe quiz question shapes/);
    });

    it('fails closed when documents have missing questions or missing options', () => {
      expect(() =>
        buildCanonicalDiscriminatorInspection({
          quizzes: [{ _id: 'quiz-missing-questions' }],
          attempts: [],
        }),
      ).toThrow(/questions is missing or null/);

      expect(() =>
        buildCanonicalDiscriminatorInspection({
          quizzes: [
            {
              _id: 'quiz-missing-options',
              questions: [{ type: 'single', correctIndex: 0, correctIndexes: [] }],
            },
          ],
          attempts: [],
        }),
      ).toThrow(/missing or invalid options/);
    });

    it('postcondition fails unless remaining affected and unsafe counts are zero', () => {
      expect(() =>
        assertCanonicalDiscriminatorPostcondition({
          totalAffectedQuestions: 0,
          unsafeCount: 0,
        }),
      ).not.toThrow();

      expect(() =>
        assertCanonicalDiscriminatorPostcondition({
          totalAffectedQuestions: 3,
          unsafeCount: 0,
        }),
      ).toThrow('remaining legacy empty correctIndexes');

      expect(() =>
        assertCanonicalDiscriminatorPostcondition({
          totalAffectedQuestions: 0,
          unsafeCount: 1,
        }),
      ).toThrow('unsafe question shape');
    });

    it('builds deterministic $unset paths for quiz and snapshot question indexes', () => {
      expect(buildUnsetSpec('questions', [0, 2])).toEqual({
        'questions.0.correctIndexes': '',
        'questions.2.correctIndexes': '',
      });
      expect(buildUnsetSpec('quizSnapshot.questions', [1])).toEqual({
        'quizSnapshot.questions.1.correctIndexes': '',
      });
    });

    it('fingerprints multi-index targets so distribution is part of the plan', () => {
      const multi = buildCanonicalDiscriminatorInspection({
        quizzes: [
          {
            _id: 'quiz-multi',
            questions: [
              legacySingle(0),
              legacySingle(1),
              { type: 'single', options: ['A', 'B'], correctIndex: 0 },
            ],
          },
        ],
        attempts: [],
      });
      expect(multi.quizTargets[0]?.affectedIndexes).toEqual([0, 1]);
      expect(multi.totalAffectedQuestions).toBe(2);
      expect(multi.planSha).toBe(
        createCanonicalDiscriminatorPlanSha({
          quizTargets: [{ id: 'quiz-multi', affectedIndexes: [0, 1] }],
          attemptTargets: [],
        }),
      );

      const split = buildCanonicalDiscriminatorInspection({
        quizzes: [
          {
            _id: 'quiz-a',
            questions: [legacySingle(0)],
          },
          {
            _id: 'quiz-b',
            questions: [legacySingle(0)],
          },
        ],
        attempts: [],
      });
      expect(split.totalAffectedQuestions).toBe(2);
      expect(split.planSha).not.toBe(multi.planSha);
    });
  });

  describe('catalog preflight and session propagation', () => {
    function createPrerequisites(names: string[] = ['attempts', 'quizzes']) {
      const collectionNames = Object.freeze([...names].sort());
      return Object.freeze({
        collectionNames,
        hasQuizzes: collectionNames.includes('quizzes'),
        hasAttempts: collectionNames.includes('attempts'),
      });
    }

    function createMockSession(id: string): ClientSession {
      return Object.assign(Object.create(null), { id });
    }

    function createInspectMockDb(options?: {
      collectionDocs?: Array<{ name: string }>;
      listCollectionsImpl?: (filter: unknown, opts: unknown) => { toArray: () => Promise<unknown> };
    }) {
      const listOptions: unknown[] = [];
      const findCalls: Array<{ collection: string; options: unknown }> = [];
      const updateCalls: Array<{ collection: string; options: unknown }> = [];
      const collectionDocs = options?.collectionDocs ?? [{ name: 'quizzes' }, { name: 'attempts' }];

      const db: Db = Object.assign(Object.create(null), {
        listCollections: (filter: unknown, opts: unknown) => {
          listOptions.push(opts);
          if (options?.listCollectionsImpl) {
            return options.listCollectionsImpl(filter, opts);
          }
          return {
            toArray: async () => collectionDocs,
          };
        },
        collection: (name: string) => ({
          find: (_filter: unknown, findOpts: unknown) => {
            findCalls.push({ collection: name, options: findOpts });
            return {
              toArray: async () => [],
            };
          },
          updateOne: async (_filter: unknown, _update: unknown, updateOpts: unknown) => {
            updateCalls.push({ collection: name, options: updateOpts });
            return { matchedCount: 1, modifiedCount: 1 };
          },
        }),
      });

      return {
        listOptions,
        findCalls,
        updateCalls,
        db,
      };
    }

    it('discovers catalog prerequisites without a session and fails closed when incomplete', async () => {
      const mock = createInspectMockDb();
      const prereqs = await discoverCanonicalDiscriminatorCollectionPrerequisites(mock.db);

      expect(mock.listOptions).toEqual([{ nameOnly: true }]);
      expect(prereqs.hasQuizzes).toBe(true);
      expect(prereqs.hasAttempts).toBe(true);
      expect(prereqs.collectionNames).toEqual(['attempts', 'quizzes']);
      expect(Object.isFrozen(prereqs)).toBe(true);
      expect(Object.isFrozen(prereqs.collectionNames)).toBe(true);

      expect(() => assertCanonicalDiscriminatorCollectionPrerequisites(prereqs)).not.toThrow();
      expect(() => assertCanonicalDiscriminatorCollectionPrerequisites(null)).toThrow(
        /Collection prerequisites are required/,
      );
      expect(() =>
        assertCanonicalDiscriminatorCollectionPrerequisites({
          collectionNames: ['quizzes'],
          hasQuizzes: true,
          hasAttempts: false,
        }),
      ).toThrow('Both quizzes and attempts collections are required');
      expect(() =>
        assertCanonicalDiscriminatorCollectionPrerequisites({
          collectionNames: ['quizzes', 'attempts'],
          hasQuizzes: true,
          // inconsistent flag vs names still fails closed on flag
          hasAttempts: false,
        }),
      ).toThrow('Both quizzes and attempts collections are required');
    });

    it('never attaches a session to listCollections; finds receive session when provided', async () => {
      const session = createMockSession('txn-session');
      const mock = createInspectMockDb();
      const collectionPrerequisites = createPrerequisites();

      await inspectCanonicalDiscriminatorMigration(mock.db, {
        session,
        collectionPrerequisites,
      });

      // Supplied prerequisites: listCollections must not run at all
      expect(mock.listOptions).toEqual([]);
      expect(mock.findCalls).toEqual([
        {
          collection: 'quizzes',
          options: { projection: { _id: 1, questions: 1 }, session },
        },
        {
          collection: 'attempts',
          options: { projection: { _id: 1, 'quizSnapshot.questions': 1 }, session },
        },
      ]);
    });

    it('omits session from listCollections and finds when none is provided (dry-run)', async () => {
      const mock = createInspectMockDb();

      await inspectCanonicalDiscriminatorMigration(mock.db);

      expect(mock.listOptions).toEqual([{ nameOnly: true }]);
      // listCollections options must not contain session even if caller forgets
      for (const opts of mock.listOptions) {
        expect(opts).toEqual({ nameOnly: true });
        expect(opts).not.toHaveProperty('session');
      }
      expect(mock.findCalls).toEqual([
        {
          collection: 'quizzes',
          options: { projection: { _id: 1, questions: 1 } },
        },
        {
          collection: 'attempts',
          options: { projection: { _id: 1, 'quizSnapshot.questions': 1 } },
        },
      ]);
    });

    it('propagates MongoServerError code 263 from catalog preflight (never swallowed)', async () => {
      const error = Object.assign(
        new Error('Cannot run listCollections in a multi-document transaction'),
        {
          name: 'MongoServerError',
          code: 263,
          codeName: 'OperationNotSupportedInTransaction',
        },
      );
      const mock = createInspectMockDb({
        listCollectionsImpl: () => ({
          toArray: async () => {
            throw error;
          },
        }),
      });

      await expect(
        discoverCanonicalDiscriminatorCollectionPrerequisites(mock.db),
      ).rejects.toMatchObject({ code: 263, codeName: 'OperationNotSupportedInTransaction' });

      await expect(inspectCanonicalDiscriminatorMigration(mock.db)).rejects.toMatchObject({
        code: 263,
      });
    });

    it('runs listCollections only before withTransaction; finds/writes use session; no listCollections in txn callback', async () => {
      const callOrder: string[] = [];
      const listOptions: unknown[] = [];
      const findCalls: Array<{ collection: string; options: unknown }> = [];
      const updateCalls: Array<{ collection: string; options: unknown }> = [];

      const legacyQuiz = {
        _id: 'quiz-1',
        questions: [
          {
            type: 'single',
            options: ['A', 'B'],
            correctIndex: 0,
            correctIndexes: [],
          },
        ],
      };
      // First inspect returns legacy rows; post-write verification returns cleaned rows
      let quizFindPass = 0;

      const db = {
        listCollections: (_filter: unknown, opts: unknown) => {
          callOrder.push('listCollections');
          listOptions.push(opts);
          return {
            toArray: async () => [{ name: 'quizzes' }, { name: 'attempts' }],
          };
        },
        collection: (name: string) => ({
          find: (_filter: unknown, findOpts: unknown) => {
            callOrder.push(`find:${name}`);
            findCalls.push({ collection: name, options: findOpts });
            return {
              toArray: async () => {
                if (name === 'quizzes') {
                  quizFindPass += 1;
                  if (quizFindPass === 1) {
                    return [legacyQuiz];
                  }
                  return [
                    {
                      _id: 'quiz-1',
                      questions: [{ type: 'single', options: ['A', 'B'], correctIndex: 0 }],
                    },
                  ];
                }
                return [];
              },
            };
          },
          updateOne: async (_filter: unknown, _update: unknown, updateOpts: unknown) => {
            callOrder.push(`updateOne:${name}`);
            updateCalls.push({ collection: name, options: updateOpts });
            return { matchedCount: 1, modifiedCount: 1 };
          },
        }),
      };

      let transactionCallbackStarted = false;
      const session: ClientSession = Object.assign(Object.create(null), {
        id: 'apply-session',
        withTransaction: async (callback: () => Promise<void>) => {
          callOrder.push('withTransaction:start');
          transactionCallbackStarted = true;
          await callback();
          callOrder.push('withTransaction:end');
        },
        endSession: async () => {
          callOrder.push('endSession');
        },
      });
      const client: MongoClient = Object.assign(Object.create(null), {
        startSession: () => session,
      });
      const typedDb: Db = Object.assign(Object.create(null), db);

      const approvedPlanSha = createCanonicalDiscriminatorPlanSha({
        quizTargets: [{ id: 'quiz-1', affectedIndexes: [0] }],
        attemptTargets: [],
      });

      const result = await applyCanonicalDiscriminatorMigration(client, typedDb, {
        approvedPlanSha,
        maxDocuments: 100,
      });

      expect(result).toEqual({ modifiedDocuments: 1 });
      expect(transactionCallbackStarted).toBe(true);

      // Catalog preflight once, before transaction callback
      expect(listOptions).toEqual([{ nameOnly: true }]);
      expect(listOptions[0]).not.toHaveProperty('session');
      const listIndex = callOrder.indexOf('listCollections');
      const txnStartIndex = callOrder.indexOf('withTransaction:start');
      expect(listIndex).toBeGreaterThanOrEqual(0);
      expect(txnStartIndex).toBeGreaterThan(listIndex);
      // No second listCollections after/during transaction
      expect(callOrder.filter((step) => step === 'listCollections')).toHaveLength(1);
      expect(callOrder.indexOf('listCollections', listIndex + 1)).toBe(-1);

      // Finds and writes inside the transaction all receive the ClientSession
      expect(findCalls.length).toBeGreaterThanOrEqual(2);
      for (const findCall of findCalls) {
        expect(findCall.options).toMatchObject({ session });
      }
      expect(updateCalls).toEqual([
        {
          collection: 'quizzes',
          options: expect.objectContaining({ session }),
        },
      ]);
      // listCollections must not appear after transaction start in the ordered log
      const stepsAfterTxn = callOrder.slice(txnStartIndex);
      expect(stepsAfterTxn).not.toContain('listCollections');
    });

    it('fails closed when preflight prerequisites become invalid before inspection', async () => {
      const mock = createInspectMockDb();
      await expect(
        inspectCanonicalDiscriminatorMigration(mock.db, {
          session: createMockSession('s'),
          collectionPrerequisites: {
            collectionNames: ['quizzes'],
            hasQuizzes: true,
            hasAttempts: false,
          },
        }),
      ).rejects.toThrow('Both quizzes and attempts collections are required');

      // Invalid prerequisites fail before any find
      expect(mock.findCalls).toEqual([]);
    });
  });
});
