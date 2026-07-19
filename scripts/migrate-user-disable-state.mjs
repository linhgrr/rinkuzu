import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';

const { loadEnvConfig } = nextEnv;

const DEFAULT_MAX_DOCUMENTS = 500;
const DEFAULT_BATCH_SIZE = 100;
const MIGRATION_COMMENT = 'migrate-user-disable-state-v1';
const ACTIVE = 0;
const DISABLED = 1;

/**
 * @typedef {{
 *   id: unknown,
 *   ops: Array<
 *     | { kind: 'set-disable'; value: 0 | 1 }
 *     | { kind: 'set-authVersion'; value: number }
 *     | { kind: 'set-disabledAt'; value: null }
 *     | { kind: 'set-disabledBy'; value: null }
 *   >,
 * }} UserDisableBackfillTarget
 *
 * @typedef {{
 *   kind: 'unsafe',
 *   id: unknown,
 *   reason: string,
 * }} UserDisableUnsafeDocument
 *
 * @typedef {{
 *   documentCount: number,
 *   backfillCount: number,
 *   unsafeCount: number,
 *   targets: UserDisableBackfillTarget[],
 *   unsafe: UserDisableUnsafeDocument[],
 *   planSha: string,
 * }} UserDisableMigrationPlan
 *
 * @typedef {{
 *   _id?: unknown,
 *   disable?: unknown,
 *   authVersion?: unknown,
 *   disabledAt?: unknown,
 *   disabledBy?: unknown,
 * }} UserDisableDocument
 *
 * @typedef {{
 *   countDocuments(filter: Record<string, unknown>): Promise<number>,
 *   find(
 *     filter: Record<string, unknown>,
 *     options: Record<string, unknown>,
 *   ): { toArray(): Promise<UserDisableDocument[]> },
 * }} UserDisableReadCollection
 *
 * @typedef {{
 *   collection(name: string): UserDisableReadCollection,
 * }} UserDisableReadDb
 *
 * @typedef {UserDisableReadCollection & {
 *   updateOne(
 *     filter: Record<string, unknown>,
 *     update: { $set: Record<string, unknown> },
 *     options: Record<string, unknown>,
 *   ): Promise<{ matchedCount: number, modifiedCount: number }>,
 * }} UserDisableWriteCollection
 *
 * @typedef {{
 *   collection(name: string): UserDisableWriteCollection,
 * }} UserDisableWriteDb
 */

/**
 * @param {unknown} value
 * @returns {value is 0 | 1}
 */
export function isValidDisable(value) {
  return value === ACTIVE || value === DISABLED;
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isValidAuthVersion(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Disabled accounts require a real Date instance with a finite timestamp.
 * Loose getTime-shaped objects and string timestamps are unsafe.
 * @param {unknown} value
 */
export function isValidDisabledAt(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * Disabled accounts require a real ObjectId instance (not string/null).
 * @param {unknown} value
 */
export function isValidDisabledBy(value) {
  return value instanceof ObjectId;
}

/**
 * Stable sort key for plan SHA independence from natural Mongo cursor order.
 * @param {unknown} id
 * @returns {string}
 */
function stableIdKey(id) {
  return String(id);
}

/**
 * @param {UserDisableBackfillTarget['ops'][number]} op
 * @returns {string}
 */
function stableOpKey(op) {
  return `${op.kind}:${JSON.stringify(op)}`;
}

/**
 * Classify one user document for safe backfill vs fail-closed unsafe.
 * Never silently normalizes invalid or contradictory values.
 *
 * @param {Record<string, unknown>} doc
 * @returns {{
 *   kind: 'clean' | 'backfill' | 'unsafe',
 *   reason?: string,
 *   ops?: UserDisableBackfillTarget['ops'],
 * }}
 */
export function classifyUserDisableDocument(doc) {
  /** @type {UserDisableBackfillTarget['ops']} */
  const ops = [];

  const hasDisable = Object.prototype.hasOwnProperty.call(doc, 'disable');
  const hasAuthVersion = Object.prototype.hasOwnProperty.call(doc, 'authVersion');
  const hasDisabledAt = Object.prototype.hasOwnProperty.call(doc, 'disabledAt');
  const hasDisabledBy = Object.prototype.hasOwnProperty.call(doc, 'disabledBy');

  if (!hasDisable) {
    ops.push({ kind: 'set-disable', value: ACTIVE });
  } else if (!isValidDisable(doc.disable)) {
    return { kind: 'unsafe', reason: `invalid disable: ${String(doc.disable)}` };
  }

  if (!hasAuthVersion) {
    ops.push({ kind: 'set-authVersion', value: 0 });
  } else if (!isValidAuthVersion(doc.authVersion)) {
    return { kind: 'unsafe', reason: `invalid authVersion: ${String(doc.authVersion)}` };
  }

  const effectiveDisable = hasDisable ? doc.disable : ACTIVE;

  if (effectiveDisable === ACTIVE) {
    // Active accounts require canonical null metadata (missing → backfill null).
    if (hasDisabledAt && doc.disabledAt !== null && doc.disabledAt !== undefined) {
      return {
        kind: 'unsafe',
        reason: 'active account has non-null disabledAt',
      };
    }
    if (hasDisabledBy && doc.disabledBy !== null && doc.disabledBy !== undefined) {
      return {
        kind: 'unsafe',
        reason: 'active account has non-null disabledBy',
      };
    }
    if (!hasDisabledAt || doc.disabledAt === undefined) {
      ops.push({ kind: 'set-disabledAt', value: null });
    }
    if (!hasDisabledBy || doc.disabledBy === undefined) {
      ops.push({ kind: 'set-disabledBy', value: null });
    }
  } else if (effectiveDisable === DISABLED) {
    // Existing disabled docs require actual valid Date disabledAt and ObjectId disabledBy.
    // Missing, null, string, or loose getTime-shaped values are unsafe (not silently fixed).
    if (!hasDisabledAt || doc.disabledAt == null || !isValidDisabledAt(doc.disabledAt)) {
      return {
        kind: 'unsafe',
        reason: 'disabled account requires valid Date disabledAt',
      };
    }
    if (!hasDisabledBy || doc.disabledBy == null || !isValidDisabledBy(doc.disabledBy)) {
      return {
        kind: 'unsafe',
        reason: 'disabled account requires valid ObjectId disabledBy',
      };
    }
  }

  if (ops.length === 0) return { kind: 'clean' };
  return { kind: 'backfill', ops };
}

/**
 * @param {{ id: unknown, ops: UserDisableBackfillTarget['ops'] }[]} targets
 * @param {UserDisableUnsafeDocument[]} unsafe
 * @param {number} documentCount
 * @returns {string}
 */
export function createUserDisablePlanSha(targets, unsafe, documentCount) {
  const sortedTargets = [...targets]
    .map((target) => ({
      id: stableIdKey(target.id),
      ops: [...target.ops].sort((a, b) => stableOpKey(a).localeCompare(stableOpKey(b))),
    }))
    .sort((a, b) => {
      const byId = a.id.localeCompare(b.id);
      if (byId !== 0) return byId;
      return JSON.stringify(a.ops).localeCompare(JSON.stringify(b.ops));
    });

  const sortedUnsafe = [...unsafe]
    .map((item) => ({
      id: stableIdKey(item.id),
      reason: item.reason,
    }))
    .sort((a, b) => {
      const byId = a.id.localeCompare(b.id);
      if (byId !== 0) return byId;
      return a.reason.localeCompare(b.reason);
    });

  const payload = {
    documentCount,
    targets: sortedTargets,
    unsafe: sortedUnsafe,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * @param {Array<Record<string, unknown>>} documents
 * @returns {UserDisableMigrationPlan}
 */
export function buildUserDisableMigrationPlan(documents) {
  /** @type {UserDisableBackfillTarget[]} */
  const targets = [];
  /** @type {UserDisableUnsafeDocument[]} */
  const unsafe = [];

  for (const doc of documents) {
    const id = doc._id;
    const classification = classifyUserDisableDocument(doc);
    if (classification.kind === 'unsafe') {
      unsafe.push({
        kind: 'unsafe',
        id,
        reason: classification.reason ?? 'unknown',
      });
      continue;
    }
    if (classification.kind === 'backfill' && classification.ops) {
      targets.push({ id, ops: classification.ops });
    }
  }

  // Canonical order so SHA is independent of natural Mongo cursor order.
  targets.sort((a, b) => {
    const byId = stableIdKey(a.id).localeCompare(stableIdKey(b.id));
    if (byId !== 0) return byId;
    return JSON.stringify(a.ops).localeCompare(JSON.stringify(b.ops));
  });
  unsafe.sort((a, b) => {
    const byId = stableIdKey(a.id).localeCompare(stableIdKey(b.id));
    if (byId !== 0) return byId;
    return a.reason.localeCompare(b.reason);
  });

  const planSha = createUserDisablePlanSha(targets, unsafe, documents.length);
  return {
    documentCount: documents.length,
    backfillCount: targets.length,
    unsafeCount: unsafe.length,
    targets,
    unsafe,
    planSha,
  };
}

/**
 * @param {UserDisableBackfillTarget['ops']} ops
 * @returns {Record<string, unknown>}
 */
export function buildBackfillSet(ops) {
  /** @type {Record<string, unknown>} */
  const $set = {};
  for (const op of ops) {
    if (op.kind === 'set-disable') $set.disable = op.value;
    if (op.kind === 'set-authVersion') $set.authVersion = op.value;
    if (op.kind === 'set-disabledAt') $set.disabledAt = op.value;
    if (op.kind === 'set-disabledBy') $set.disabledBy = op.value;
  }
  return $set;
}

/**
 * Conditional filter: only apply safe backfill when still missing/invalid-safe.
 * @param {unknown} id
 * @param {UserDisableBackfillTarget['ops']} ops
 * @returns {Record<string, unknown>}
 */
export function buildBackfillFilter(id, ops) {
  /** @type {Record<string, unknown>} */
  const filter = { _id: id };
  for (const op of ops) {
    if (op.kind === 'set-disable') {
      filter.disable = { $exists: false };
    }
    if (op.kind === 'set-authVersion') {
      filter.authVersion = { $exists: false };
    }
    if (op.kind === 'set-disabledAt') {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [{ disabledAt: { $exists: false } }, { disabledAt: null }],
        },
        {
          $or: [{ disable: { $exists: false } }, { disable: ACTIVE }],
        },
      ];
    }
    if (op.kind === 'set-disabledBy') {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [{ disabledBy: { $exists: false } }, { disabledBy: null }],
        },
        {
          $or: [{ disable: { $exists: false } }, { disable: ACTIVE }],
        },
      ];
    }
  }
  return filter;
}

/**
 * @param {{
 *   apply: boolean,
 *   approvedPlanSha?: string,
 *   maxDocuments: number,
 *   plan: UserDisableMigrationPlan,
 * }} options
 */
export function validateUserDisableMigration(options) {
  const { apply, approvedPlanSha, maxDocuments, plan } = options;

  if (!Number.isInteger(maxDocuments) || maxDocuments < 1) {
    throw new Error('max-documents must be a positive integer');
  }
  // Dry-run inventories every unsafe/backfill row; max-doc cap is apply-only.
  if (apply && plan.backfillCount > maxDocuments) {
    throw new Error(
      `Plan backfillCount ${plan.backfillCount} exceeds max-documents ${maxDocuments}`,
    );
  }
  if (plan.unsafeCount > 0) {
    throw new Error(
      `Migration fail-closed: ${plan.unsafeCount} document(s) have invalid disable/authVersion state`,
    );
  }
  // Apply always requires exact plan SHA approval, including zero-plan apply.
  if (apply) {
    if (!approvedPlanSha) {
      throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
    }
    if (approvedPlanSha !== plan.planSha) {
      throw new Error(
        `Approved plan SHA mismatch: expected ${plan.planSha}, got ${approvedPlanSha}`,
      );
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
export function parsePositiveIntegerOption(value, name) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

/**
 * Reject incompatible CLI mode combinations before any DB work.
 * @param {{
 *   apply: boolean,
 *   verifyOnly: boolean,
 *   approvedPlanSha?: string,
 * }} options
 */
export function validateUserDisableMigrationModes(options) {
  const { apply, verifyOnly, approvedPlanSha } = options;
  if (verifyOnly && apply) {
    throw new Error('--verify cannot be combined with --apply');
  }
  if (verifyOnly && approvedPlanSha !== undefined) {
    throw new Error('--verify cannot be combined with --approve-plan');
  }
  if (!apply && !verifyOnly && approvedPlanSha !== undefined) {
    throw new Error('--approve-plan requires --apply');
  }
}

/**
 * @param {UserDisableWriteDb} db
 * @param {UserDisableMigrationPlan} plan
 * @param {{ batchSize?: number }} [options]
 */
export async function applyUserDisableBackfill(db, plan, options = {}) {
  const batchSize = parsePositiveIntegerOption(
    options.batchSize ?? DEFAULT_BATCH_SIZE,
    'batch-size',
  );
  let modifiedDocuments = 0;
  const collection = db.collection('users');

  for (let index = 0; index < plan.targets.length; index += batchSize) {
    const batch = plan.targets.slice(index, index + batchSize);
    for (const target of batch) {
      const filter = buildBackfillFilter(target.id, target.ops);
      const $set = buildBackfillSet(target.ops);
      const result = await collection.updateOne(filter, { $set }, { comment: MIGRATION_COMMENT });
      if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
        throw new Error(
          `Conditional backfill failed for user ${String(target.id)} (matched=${result.matchedCount}, modified=${result.modifiedCount})`,
        );
      }
      modifiedDocuments += result.modifiedCount;
    }
  }

  if (modifiedDocuments !== plan.backfillCount) {
    throw new Error(
      `Modified count ${modifiedDocuments} does not match plan backfillCount ${plan.backfillCount}`,
    );
  }

  return { modifiedDocuments };
}

/**
 * Postcondition: every user has exact disable 0|1 and non-negative integer authVersion.
 * Active metadata null where disable is 0; disabled docs require Date + ObjectId metadata.
 * @param {UserDisableReadDb} db
 */
export async function verifyUserDisablePostcondition(db) {
  const users = db.collection('users');
  const invalidDisable = await users.countDocuments({
    disable: { $nin: [ACTIVE, DISABLED] },
  });
  if (invalidDisable > 0) {
    throw new Error(`Postcondition failed: ${invalidDisable} user(s) missing/invalid disable`);
  }

  const authVersionScan = await users
    .find(
      {},
      {
        projection: { disable: 1, authVersion: 1, disabledAt: 1, disabledBy: 1 },
        sort: { _id: 1 },
      },
    )
    .toArray();

  for (const doc of authVersionScan) {
    if (!isValidDisable(doc.disable)) {
      throw new Error(`Postcondition failed: user ${String(doc._id)} has invalid disable`);
    }
    if (!isValidAuthVersion(doc.authVersion)) {
      throw new Error(`Postcondition failed: user ${String(doc._id)} has invalid authVersion`);
    }
    if (doc.disable === ACTIVE) {
      // Active documents must OWN disabledAt/disabledBy and both must be exactly null.
      // Missing/undefined properties fail closed (projection must not invent them).
      if (!Object.prototype.hasOwnProperty.call(doc, 'disabledAt') || doc.disabledAt !== null) {
        throw new Error(
          `Postcondition failed: active user ${String(doc._id)} must own disabledAt === null`,
        );
      }
      if (!Object.prototype.hasOwnProperty.call(doc, 'disabledBy') || doc.disabledBy !== null) {
        throw new Error(
          `Postcondition failed: active user ${String(doc._id)} must own disabledBy === null`,
        );
      }
    } else if (doc.disable === DISABLED) {
      if (!isValidDisabledAt(doc.disabledAt)) {
        throw new Error(
          `Postcondition failed: disabled user ${String(doc._id)} missing valid Date disabledAt`,
        );
      }
      if (!isValidDisabledBy(doc.disabledBy)) {
        throw new Error(
          `Postcondition failed: disabled user ${String(doc._id)} missing valid ObjectId disabledBy`,
        );
      }
    }
  }

  return { verified: true, documentCount: authVersionScan.length };
}

/**
 * @param {UserDisableReadDb} db
 * @returns {Promise<UserDisableMigrationPlan>}
 */
export async function inspectUserDisableMigration(db) {
  const documents = await db
    .collection('users')
    .find(
      {},
      {
        projection: {
          _id: 1,
          disable: 1,
          authVersion: 1,
          disabledAt: 1,
          disabledBy: 1,
        },
        sort: { _id: 1 },
      },
    )
    .toArray();
  return buildUserDisableMigrationPlan(/** @type {Array<Record<string, unknown>>} */ (documents));
}

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function readOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const apply = process.argv.includes('--apply');
  const verifyOnly = process.argv.includes('--verify');
  const approvedPlanSha = readOption('approve-plan');
  const maxDocumentsRaw = readOption('max-documents');
  const batchSizeRaw = readOption('batch-size');
  const maxDocuments =
    maxDocumentsRaw === undefined ? DEFAULT_MAX_DOCUMENTS : Number(maxDocumentsRaw);
  const batchSize = batchSizeRaw === undefined ? DEFAULT_BATCH_SIZE : Number(batchSizeRaw);

  validateUserDisableMigrationModes({
    apply,
    verifyOnly,
    ...(approvedPlanSha !== undefined ? { approvedPlanSha } : {}),
  });
  parsePositiveIntegerOption(maxDocuments, 'max-documents');
  parsePositiveIntegerOption(batchSize, 'batch-size');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db();

    if (verifyOnly) {
      const verification = await verifyUserDisablePostcondition(db);
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'verify',
            databaseName: db.databaseName,
            ...verification,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    const plan = await inspectUserDisableMigration(db);
    validateUserDisableMigration({
      apply,
      ...(approvedPlanSha !== undefined ? { approvedPlanSha } : {}),
      maxDocuments,
      plan,
    });

    let modifiedDocuments = 0;
    let verified = undefined;

    if (apply) {
      if (plan.backfillCount > 0) {
        const applyResult = await applyUserDisableBackfill(db, plan, { batchSize });
        modifiedDocuments = applyResult.modifiedDocuments;
      }
      await verifyUserDisablePostcondition(db);
      verified = true;

      // Idempotent: re-plan must be zero after apply.
      const replan = await inspectUserDisableMigration(db);
      if (replan.backfillCount !== 0 || replan.unsafeCount !== 0) {
        throw new Error(
          `Post-apply plan is not zero: backfill=${replan.backfillCount} unsafe=${replan.unsafeCount}`,
        );
      }
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          databaseName: db.databaseName,
          documentCount: plan.documentCount,
          backfillCount: plan.backfillCount,
          unsafeCount: plan.unsafeCount,
          planSha: plan.planSha,
          maxDocuments,
          batchSize,
          modifiedDocuments,
          verified,
          unsafeSample: plan.unsafe.slice(0, 10).map((item) => ({
            id: String(item.id),
            reason: item.reason,
          })),
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
