import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

import { readCliOptions } from './cli-options.shared.mjs';

const { loadEnvConfig } = nextEnv;

const DEFAULT_MAX_DOCUMENTS = 500;
const MIGRATION_COMMENT = 'migrate-canonical-quiz-question-discriminator-v1';
const VALID_TYPES = new Set(['single', 'multiple']);

/**
 * @typedef {'clean' | 'legacy-empty-opposite' | 'unsafe'} QuestionInspectionKind
 * @typedef {{ kind: QuestionInspectionKind, reason?: string, index: number }} QuestionInspection
 * @typedef {{ id: unknown, affectedIndexes: number[] }} CanonicalDiscriminatorTarget
 * @typedef {{
 *   quizDocumentCount: number,
 *   attemptDocumentCount: number,
 *   quizQuestionCount: number,
 *   attemptQuestionCount: number,
 *   quizAffectedDocumentCount: number,
 *   attemptAffectedDocumentCount: number,
 *   quizAffectedQuestionCount: number,
 *   attemptAffectedQuestionCount: number,
 *   totalAffectedDocuments: number,
 *   totalAffectedQuestions: number,
 *   unsafeCount: number,
 *   quizTargets: CanonicalDiscriminatorTarget[],
 *   attemptTargets: CanonicalDiscriminatorTarget[],
 *   planSha: string,
 * }} CanonicalDiscriminatorPlan
 */

/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
export function isEmptyArray(value) {
  return Array.isArray(value) && value.length === 0;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Validate answer-key shape for a single-choice question.
 * @param {Record<string, unknown>} question
 * @returns {string | null} error reason or null when valid
 */
function validateSingleAnswerKey(question) {
  const { correctIndex, options } = question;
  if (correctIndex === undefined || correctIndex === null) {
    return 'single question missing correctIndex';
  }
  if (!isNonNegativeInteger(correctIndex)) {
    return 'single question has invalid correctIndex';
  }
  if (options === undefined || options === null || !Array.isArray(options)) {
    return 'single question missing or invalid options';
  }
  if (correctIndex >= options.length) {
    return 'single question correctIndex out of options range';
  }
  return null;
}

/**
 * Validate answer-key shape for a multiple-choice question.
 * @param {Record<string, unknown>} question
 * @returns {string | null}
 */
function validateMultipleAnswerKey(question) {
  const { correctIndexes, options } = question;
  if (correctIndexes === undefined || correctIndexes === null) {
    return 'multiple question missing correctIndexes';
  }
  if (!Array.isArray(correctIndexes)) {
    return 'multiple question has invalid correctIndexes';
  }
  if (correctIndexes.length === 0) {
    return 'multiple question has empty correctIndexes';
  }
  if (!correctIndexes.every((index) => isNonNegativeInteger(index))) {
    return 'multiple question has invalid correctIndexes';
  }
  if (new Set(correctIndexes).size !== correctIndexes.length) {
    return 'multiple question has duplicate correctIndexes';
  }
  if (options === undefined || options === null || !Array.isArray(options)) {
    return 'multiple question missing or invalid options';
  }
  if (correctIndexes.some((index) => index >= options.length)) {
    return 'multiple question correctIndexes out of options range';
  }
  return null;
}

/**
 * Classify one quiz/snapshot question element for migration safety.
 *
 * Safe migration target: type === 'single' with valid correctIndex and
 * correctIndexes exactly [] (legacy opposite empty array).
 *
 * @param {unknown} question
 * @param {number} index
 * @returns {QuestionInspection}
 */
export function inspectQuestionElement(question, index) {
  if (question === null || typeof question !== 'object' || Array.isArray(question)) {
    return { kind: 'unsafe', reason: 'question element is not an object', index };
  }

  const record = /** @type {Record<string, unknown>} */ (question);
  const type = record.type;

  if (type === undefined || type === null || type === '') {
    return { kind: 'unsafe', reason: 'missing type', index };
  }
  if (typeof type !== 'string' || !VALID_TYPES.has(type)) {
    return { kind: 'unsafe', reason: `unknown type: ${String(type)}`, index };
  }

  if (type === 'single') {
    const answerKeyError = validateSingleAnswerKey(record);
    if (answerKeyError) {
      return { kind: 'unsafe', reason: answerKeyError, index };
    }

    if ('correctIndexes' in record && record.correctIndexes !== undefined) {
      if (isEmptyArray(record.correctIndexes)) {
        return { kind: 'legacy-empty-opposite', index };
      }
      if (Array.isArray(record.correctIndexes)) {
        return {
          kind: 'unsafe',
          reason: 'single nonempty opposite correctIndexes',
          index,
        };
      }
      return {
        kind: 'unsafe',
        reason: 'single has invalid correctIndexes opposite field',
        index,
      };
    }

    return { kind: 'clean', index };
  }

  // type === 'multiple'
  if ('correctIndex' in record && record.correctIndex !== undefined) {
    return { kind: 'unsafe', reason: 'multiple has correctIndex', index };
  }

  const answerKeyError = validateMultipleAnswerKey(record);
  if (answerKeyError) {
    return { kind: 'unsafe', reason: answerKeyError, index };
  }

  return { kind: 'clean', index };
}

/**
 * Inspect a questions array on a parent document.
 * Missing/null/non-array questions are unsafe (not silently clean).
 * @param {unknown} questions
 * @returns {{
 *   elementCount: number,
 *   affectedIndexes: number[],
 *   unsafe: QuestionInspection[],
 * }}
 */
export function inspectQuestionsArray(questions) {
  if (questions === undefined || questions === null) {
    return {
      elementCount: 0,
      affectedIndexes: [],
      unsafe: [{ kind: 'unsafe', reason: 'questions is missing or null', index: -1 }],
    };
  }
  if (!Array.isArray(questions)) {
    return {
      elementCount: 0,
      affectedIndexes: [],
      unsafe: [{ kind: 'unsafe', reason: 'questions is not an array', index: -1 }],
    };
  }

  /** @type {number[]} */
  const affectedIndexes = [];
  /** @type {QuestionInspection[]} */
  const unsafe = [];

  questions.forEach((question, index) => {
    const result = inspectQuestionElement(question, index);
    if (result.kind === 'legacy-empty-opposite') {
      affectedIndexes.push(index);
    } else if (result.kind === 'unsafe') {
      unsafe.push(result);
    }
  });

  return {
    elementCount: questions.length,
    affectedIndexes,
    unsafe,
  };
}

/**
 * Normalize targets for stable hashing: sort by id string, sort affectedIndexes ascending.
 * @param {CanonicalDiscriminatorTarget[]} targets
 * @returns {Array<{ id: string, affectedIndexes: number[] }>}
 */
export function normalizeCanonicalDiscriminatorTargets(targets) {
  return targets
    .map((target) => ({
      id: String(target.id),
      affectedIndexes: [...target.affectedIndexes].sort((a, b) => a - b),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Deterministic SHA-256 plan fingerprint from exact per-doc targets
 * (sorted by id, each with sorted affectedIndexes). Same ids/counts with
 * different index distribution must change the SHA.
 * @param {{
 *   quizTargets: CanonicalDiscriminatorTarget[],
 *   attemptTargets: CanonicalDiscriminatorTarget[],
 * }} input
 * @returns {string}
 */
export function createCanonicalDiscriminatorPlanSha({ quizTargets, attemptTargets }) {
  const normalized = {
    attemptTargets: normalizeCanonicalDiscriminatorTargets(attemptTargets),
    quizTargets: normalizeCanonicalDiscriminatorTargets(quizTargets),
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Fail-closed apply validation: plan approval, max document cap, positive safe integer.
 * @param {{
 *   apply: boolean,
 *   approvedPlanSha?: string,
 *   maxDocuments: number,
 *   plan: {
 *     planSha: string,
 *     totalAffectedDocuments: number,
 *     totalAffectedQuestions: number,
 *   },
 * }} input
 */
export function validateCanonicalDiscriminatorMigration({
  apply,
  approvedPlanSha,
  maxDocuments,
  plan,
}) {
  if (!Number.isSafeInteger(maxDocuments) || maxDocuments < 1) {
    throw new Error('--max-documents must be a positive safe integer');
  }
  if (!apply || plan.totalAffectedDocuments === 0) {
    return;
  }
  if (plan.totalAffectedDocuments > maxDocuments) {
    throw new Error(
      `Migration plan contains ${plan.totalAffectedDocuments} documents, above the --max-documents limit of ${maxDocuments}`,
    );
  }
  if (!approvedPlanSha) {
    throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
  }
  if (approvedPlanSha !== plan.planSha) {
    throw new Error('Approved plan SHA does not match the current migration plan');
  }
}

/**
 * @param {{ totalAffectedQuestions: number, unsafeCount: number }} inspection
 */
export function assertCanonicalDiscriminatorPostcondition(inspection) {
  if (inspection.unsafeCount > 0) {
    throw new Error(
      `Post-apply verification found ${inspection.unsafeCount} unsafe question shape(s)`,
    );
  }
  if (inspection.totalAffectedQuestions !== 0) {
    throw new Error(
      `Post-apply verification found ${inspection.totalAffectedQuestions} remaining legacy empty correctIndexes`,
    );
  }
}

/**
 * Require matchedCount===1 and modifiedCount===1 for one target write.
 * Drift / no-op / missing docs throw (fail closed).
 * @param {{
 *   matchedCount: number,
 *   modifiedCount: number,
 *   source: string,
 *   targetId: unknown,
 * }} input
 */
export function assertCanonicalDiscriminatorWriteResult({
  matchedCount,
  modifiedCount,
  source,
  targetId,
}) {
  if (matchedCount !== 1 || modifiedCount !== 1) {
    throw new Error(
      `${source} ${String(targetId)} expected matchedCount=1 and modifiedCount=1, got matched=${matchedCount} modified=${modifiedCount}`,
    );
  }
}

/**
 * Total modified documents must equal the plan's affected document count.
 * @param {number} modifiedDocuments
 * @param {number} totalAffectedDocuments
 */
export function assertCanonicalDiscriminatorTotalModified(
  modifiedDocuments,
  totalAffectedDocuments,
) {
  if (modifiedDocuments !== totalAffectedDocuments) {
    throw new Error(
      `Modified ${modifiedDocuments} documents but plan targeted ${totalAffectedDocuments}`,
    );
  }
}

/**
 * Build a full inspection plan from already-loaded quiz/attempt documents (pure; unit-testable).
 * Throws when any unsafe shape is present.
 * @param {{
 *   quizzes: Array<{ _id: unknown, questions?: unknown }>,
 *   attempts: Array<{ _id: unknown, quizSnapshot?: { questions?: unknown } }>,
 * }} input
 * @returns {CanonicalDiscriminatorPlan}
 */
export function buildCanonicalDiscriminatorInspection({ quizzes, attempts }) {
  /** @type {CanonicalDiscriminatorTarget[]} */
  const quizTargets = [];
  /** @type {CanonicalDiscriminatorTarget[]} */
  const attemptTargets = [];
  /** @type {Array<{ source: string, documentId: string, index: number, reason: string }>} */
  const unsafeFindings = [];

  let quizQuestionCount = 0;
  let attemptQuestionCount = 0;
  let quizAffectedQuestionCount = 0;
  let attemptAffectedQuestionCount = 0;

  for (const quiz of quizzes) {
    const scan = inspectQuestionsArray(quiz.questions);
    quizQuestionCount += scan.elementCount;
    for (const item of scan.unsafe) {
      unsafeFindings.push({
        source: 'quizzes.questions',
        documentId: String(quiz._id),
        index: item.index,
        reason: item.reason ?? 'unsafe',
      });
    }
    if (scan.affectedIndexes.length > 0) {
      quizTargets.push({ id: quiz._id, affectedIndexes: scan.affectedIndexes });
      quizAffectedQuestionCount += scan.affectedIndexes.length;
    }
  }

  for (const attempt of attempts) {
    const scan = inspectQuestionsArray(attempt.quizSnapshot?.questions);
    attemptQuestionCount += scan.elementCount;
    for (const item of scan.unsafe) {
      unsafeFindings.push({
        source: 'attempts.quizSnapshot.questions',
        documentId: String(attempt._id),
        index: item.index,
        reason: item.reason ?? 'unsafe',
      });
    }
    if (scan.affectedIndexes.length > 0) {
      attemptTargets.push({ id: attempt._id, affectedIndexes: scan.affectedIndexes });
      attemptAffectedQuestionCount += scan.affectedIndexes.length;
    }
  }

  if (unsafeFindings.length > 0) {
    const sample = unsafeFindings
      .slice(0, 5)
      .map((f) => `${f.source} doc=${f.documentId} idx=${f.index}: ${f.reason}`)
      .join('; ');
    throw new Error(
      `Unsafe quiz question shapes require manual review before migration (${unsafeFindings.length}): ${sample}`,
    );
  }

  const planSha = createCanonicalDiscriminatorPlanSha({
    quizTargets,
    attemptTargets,
  });

  return {
    quizDocumentCount: quizzes.length,
    attemptDocumentCount: attempts.length,
    quizQuestionCount,
    attemptQuestionCount,
    quizAffectedDocumentCount: quizTargets.length,
    attemptAffectedDocumentCount: attemptTargets.length,
    quizAffectedQuestionCount,
    attemptAffectedQuestionCount,
    totalAffectedDocuments: quizTargets.length + attemptTargets.length,
    totalAffectedQuestions: quizAffectedQuestionCount + attemptAffectedQuestionCount,
    unsafeCount: 0,
    quizTargets,
    attemptTargets,
    planSha,
  };
}

/**
 * @typedef {{
 *   collectionNames: readonly string[],
 *   hasQuizzes: boolean,
 *   hasAttempts: boolean,
 * }} CanonicalDiscriminatorCollectionPrerequisites
 */

/**
 * Catalog preflight for required collections.
 *
 * MUST run outside multi-document transactions: MongoDB rejects `listCollections`
 * (and `listIndexes`) inside a transaction with code 263
 * `OperationNotSupportedInTransaction`. See:
 * https://www.mongodb.com/docs/v8.0/core/transactions-operations/
 *
 * Catalog discovery therefore cannot be transactional (TOCTOU is inherent to the
 * Mongo restriction). Conditional data writes and plan revalidation remain inside
 * `withTransaction`. Never pass a ClientSession to this function.
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<CanonicalDiscriminatorCollectionPrerequisites>}
 */
export async function discoverCanonicalDiscriminatorCollectionPrerequisites(db) {
  // Intentionally no session: listCollections is forbidden in multi-doc transactions.
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(
    ({ name }) => name,
  );
  const collectionNames = Object.freeze([...names].sort());
  return Object.freeze({
    collectionNames,
    hasQuizzes: collectionNames.includes('quizzes'),
    hasAttempts: collectionNames.includes('attempts'),
  });
}

/**
 * Fail closed when catalog prerequisite state is missing or invalid.
 * Does not treat Mongo error code 263 as success.
 * @param {unknown} prerequisites
 * @returns {asserts prerequisites is CanonicalDiscriminatorCollectionPrerequisites}
 */
export function assertCanonicalDiscriminatorCollectionPrerequisites(prerequisites) {
  if (prerequisites === null || typeof prerequisites !== 'object' || Array.isArray(prerequisites)) {
    throw new Error('Collection prerequisites are required and must be a non-null object');
  }
  const record = /** @type {Record<string, unknown>} */ (prerequisites);
  if (!Array.isArray(record.collectionNames)) {
    throw new Error('Collection prerequisites.collectionNames must be an array');
  }
  if (record.hasQuizzes !== true || record.hasAttempts !== true) {
    throw new Error('Both quizzes and attempts collections are required');
  }
  if (!record.collectionNames.includes('quizzes') || !record.collectionNames.includes('attempts')) {
    throw new Error('Both quizzes and attempts collections are required');
  }
}

/**
 * Read-only scan of quizzes + attempts for legacy empty opposite fields.
 *
 * Collection catalog discovery never runs with a transaction session. When
 * `collectionPrerequisites` is omitted (dry-run / out-of-transaction), discovery
 * runs here without a session. When called from an apply transaction, pass the
 * immutable prerequisites from pre-transaction preflight so `listCollections` is
 * not invoked inside the transaction callback.
 *
 * @param {import('mongodb').Db} db
 * @param {{
 *   session?: import('mongodb').ClientSession,
 *   collectionPrerequisites?: CanonicalDiscriminatorCollectionPrerequisites,
 * }} [options]
 * @returns {Promise<CanonicalDiscriminatorPlan>}
 */
export async function inspectCanonicalDiscriminatorMigration(db, options = {}) {
  const { session, collectionPrerequisites: providedPrerequisites } = options;

  // Never listCollections with a session (Mongo code 263). Prefer caller-supplied
  // immutable preflight state for in-transaction inspection.
  const collectionPrerequisites =
    providedPrerequisites ?? (await discoverCanonicalDiscriminatorCollectionPrerequisites(db));
  assertCanonicalDiscriminatorCollectionPrerequisites(collectionPrerequisites);

  /** @type {import('mongodb').FindOptions} */
  const findOptions = session
    ? { projection: { _id: 1, questions: 1 }, session }
    : { projection: { _id: 1, questions: 1 } };
  /** @type {import('mongodb').FindOptions} */
  const attemptFindOptions = session
    ? { projection: { _id: 1, 'quizSnapshot.questions': 1 }, session }
    : { projection: { _id: 1, 'quizSnapshot.questions': 1 } };

  // Sequential finds: withTransaction forbids Promise.all (architecture check).
  // CRUD reads may use the transaction session; catalog commands must not.
  const quizzes = await db.collection('quizzes').find({}, findOptions).toArray();
  const attempts = await db.collection('attempts').find({}, attemptFindOptions).toArray();

  return buildCanonicalDiscriminatorInspection({ quizzes, attempts });
}

/**
 * @param {string} fieldPrefix e.g. "questions" or "quizSnapshot.questions"
 * @param {number[]} indexes
 * @returns {Record<string, ''>}
 */
export function buildUnsetSpec(fieldPrefix, indexes) {
  /** @type {Record<string, ''>} */
  const unset = {};
  for (const index of indexes) {
    unset[`${fieldPrefix}.${index}.correctIndexes`] = '';
  }
  return unset;
}

/**
 * Conditional update filter: never _id-only.
 * Reasserts at every targeted numeric path that type === 'single' and
 * correctIndexes is exactly the empty array.
 * @param {string} fieldPrefix e.g. "questions" or "quizSnapshot.questions"
 * @param {unknown} id
 * @param {number[]} indexes
 * @returns {Record<string, unknown>}
 */
export function buildConditionalUnsetFilter(fieldPrefix, id, indexes) {
  /** @type {Record<string, unknown>} */
  const filter = { _id: id };
  for (const index of indexes) {
    filter[`${fieldPrefix}.${index}.type`] = 'single';
    filter[`${fieldPrefix}.${index}.correctIndexes`] = [];
  }
  return filter;
}

/**
 * Apply approved unsets for one plan (optional session). Caller validates the plan.
 * Requires matchedCount===1 AND modifiedCount===1 per target, and total modified
 * equals totalAffectedDocuments.
 * @param {import('mongodb').Db} db
 * @param {CanonicalDiscriminatorPlan} plan
 * @param {{ session?: import('mongodb').ClientSession }} [options]
 */
export async function applyCanonicalDiscriminatorWrites(db, plan, options = {}) {
  const { session } = options;
  /** @type {import('mongodb').UpdateOptions} */
  const writeOptions = session
    ? { comment: MIGRATION_COMMENT, session }
    : { comment: MIGRATION_COMMENT };

  let modifiedDocuments = 0;

  for (const target of plan.quizTargets) {
    const filter = buildConditionalUnsetFilter('questions', target.id, target.affectedIndexes);
    const result = await db
      .collection('quizzes')
      .updateOne(
        filter,
        { $unset: buildUnsetSpec('questions', target.affectedIndexes) },
        writeOptions,
      );
    assertCanonicalDiscriminatorWriteResult({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      source: 'Quiz',
      targetId: target.id,
    });
    modifiedDocuments += result.modifiedCount;
  }

  for (const target of plan.attemptTargets) {
    const filter = buildConditionalUnsetFilter(
      'quizSnapshot.questions',
      target.id,
      target.affectedIndexes,
    );
    const result = await db
      .collection('attempts')
      .updateOne(
        filter,
        { $unset: buildUnsetSpec('quizSnapshot.questions', target.affectedIndexes) },
        writeOptions,
      );
    assertCanonicalDiscriminatorWriteResult({
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      source: 'Attempt',
      targetId: target.id,
    });
    modifiedDocuments += result.modifiedCount;
  }

  assertCanonicalDiscriminatorTotalModified(modifiedDocuments, plan.totalAffectedDocuments);
  return { modifiedDocuments };
}

/**
 * Apply in a ClientSession transaction: re-inspect under the session, revalidate
 * approved SHA / max caps on that transaction plan, write with session/comment,
 * verify postcondition inside the transaction, then commit or roll back all.
 *
 * Catalog preflight (`listCollections`) runs once *before* `withTransaction` with
 * no session — MongoDB forbids listCollections in multi-document transactions
 * (code 263). That preflight is non-transactional by Mongo restriction (not a
 * silent fallback). Inside the transaction only supported CRUD finds/writes run
 * with the same session, using the immutable prerequisite snapshot. Plan SHA /
 * conditional write filters / matched-modified / postcondition checks stay inside.
 *
 * @param {import('mongodb').MongoClient} client
 * @param {import('mongodb').Db} db
 * @param {{
 *   approvedPlanSha: string,
 *   maxDocuments: number,
 * }} applyOptions
 */
export async function applyCanonicalDiscriminatorMigration(client, db, applyOptions) {
  const { approvedPlanSha, maxDocuments } = applyOptions;

  // Outside transaction: listCollections is restricted in multi-doc transactions.
  const collectionPrerequisites = await discoverCanonicalDiscriminatorCollectionPrerequisites(db);
  assertCanonicalDiscriminatorCollectionPrerequisites(collectionPrerequisites);

  const session = client.startSession();

  try {
    /** @type {{ modifiedDocuments: number }} */
    let applyResult = { modifiedDocuments: 0 };

    await session.withTransaction(async () => {
      // In-transaction inspection: only CRUD with session; no listCollections.
      const transactionPlan = await inspectCanonicalDiscriminatorMigration(db, {
        session,
        collectionPrerequisites,
      });
      validateCanonicalDiscriminatorMigration({
        apply: true,
        approvedPlanSha,
        maxDocuments,
        plan: transactionPlan,
      });

      if (transactionPlan.totalAffectedDocuments === 0) {
        assertCanonicalDiscriminatorPostcondition(transactionPlan);
        applyResult = { modifiedDocuments: 0 };
        return;
      }

      applyResult = await applyCanonicalDiscriminatorWrites(db, transactionPlan, { session });

      const verification = await inspectCanonicalDiscriminatorMigration(db, {
        session,
        collectionPrerequisites,
      });
      assertCanonicalDiscriminatorPostcondition(verification);
    });

    return applyResult;
  } finally {
    await session.endSession();
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const options = readCliOptions({
    apply: { type: 'boolean', default: false },
    'approve-plan': { type: 'string' },
    'max-documents': { type: 'string' },
  });
  const apply = options.apply;
  const approvedPlanSha = options['approve-plan'];
  const maxDocumentsRaw = options['max-documents'];
  const maxDocuments =
    maxDocumentsRaw === undefined ? DEFAULT_MAX_DOCUMENTS : Number(maxDocumentsRaw);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db();
    // Dry-run and pre-apply plan: read-only, no session/transaction.
    const plan = await inspectCanonicalDiscriminatorMigration(db);
    validateCanonicalDiscriminatorMigration({
      apply,
      approvedPlanSha,
      maxDocuments,
      plan,
    });

    let modifiedDocuments = 0;
    let verified = undefined;

    if (apply && plan.totalAffectedDocuments > 0) {
      if (!approvedPlanSha) {
        throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
      }
      const applyResult = await applyCanonicalDiscriminatorMigration(client, db, {
        approvedPlanSha,
        maxDocuments,
      });
      modifiedDocuments = applyResult.modifiedDocuments;
      verified = true;
    } else if (apply && plan.totalAffectedDocuments === 0) {
      // Empty apply remains idempotent: no writes, no transaction.
      assertCanonicalDiscriminatorPostcondition(plan);
      verified = true;
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          databaseName: db.databaseName,
          quizDocumentCount: plan.quizDocumentCount,
          attemptDocumentCount: plan.attemptDocumentCount,
          quizQuestionCount: plan.quizQuestionCount,
          attemptQuestionCount: plan.attemptQuestionCount,
          quizAffectedDocumentCount: plan.quizAffectedDocumentCount,
          attemptAffectedDocumentCount: plan.attemptAffectedDocumentCount,
          quizAffectedQuestionCount: plan.quizAffectedQuestionCount,
          attemptAffectedQuestionCount: plan.attemptAffectedQuestionCount,
          totalAffectedDocuments: plan.totalAffectedDocuments,
          totalAffectedQuestions: plan.totalAffectedQuestions,
          planSha: plan.planSha,
          maxDocuments,
          modifiedDocuments,
          verified,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await client.close();
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
  await main();
}
