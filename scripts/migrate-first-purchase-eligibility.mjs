import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;

const CLAIMS_COLLECTION = 'firstpurchaseclaims';
const ELIGIBILITIES_COLLECTION = 'firstpurchaseeligibilities';
const MIGRATION_COMMENT = 'migrate-first-purchase-eligibility-v1';
const ELIGIBILITY_CLASS = 'first_purchase';
const CLAIM_USER_CLASS_KEY = { user: 1, eligibilityClass: 1 };
const CLAIM_ORDER_KEY = { order: 1 };
const ELIGIBILITY_USER_CLASS_KEY = { user: 1, eligibilityClass: 1 };
const CLAIM_ACTIVE_INDEX_NAME = 'first_purchase_claim_active_user_class_unique';
const CLAIM_ORDER_INDEX_NAME = 'first_purchase_claim_order_unique';
const ELIGIBILITY_INDEX_NAME = 'first_purchase_eligibility_user_class_unique';

/**
 * @typedef {{
 *   _id: unknown,
 *   user: unknown,
 *   eligibilityClass: string,
 *   status: 'reserved' | 'consumed' | 'released' | 'late_consumed',
 *   order: unknown,
 *   reservedAt: Date,
 *   consumedAt?: Date,
 *   releasedAt?: Date,
 * }} FirstPurchaseClaim
 *
 * @typedef {{
 *   _id?: unknown,
 *   user: unknown,
 *   eligibilityClass: string,
 *   status: 'available' | 'reserved' | 'consumed',
 *   activeOrder?: unknown,
 *   reservedAt?: Date,
 *   consumedAt?: Date,
 *   releasedAt?: Date,
 *   version?: number,
 * }} FirstPurchaseEligibility
 *
 * @typedef {{
 *   user: unknown,
 *   userKey: string,
 *   sourceFingerprint: string,
 *   desired: {
 *     user: unknown,
 *     eligibilityClass: 'first_purchase',
 *     status: 'available' | 'reserved' | 'consumed',
 *     activeOrder?: unknown,
 *     reservedAt?: Date,
 *     consumedAt?: Date,
 *     version: number,
 *   },
 *   action: 'insert' | 'noop',
 * }} EligibilityTarget
 *
 * @typedef {{
 *   name: string,
 *   key: Record<string, number>,
 *   unique?: boolean,
 *   partialFilterExpression?: Record<string, unknown>,
 * }} IndexDescription
 */

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function groupBy(values, keyOf) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyOf(value);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(value);
    else grouped.set(key, [value]);
  }
  return grouped;
}

function identity(value) {
  if (value == null) throw new Error('First-purchase migration found a missing identity');
  return String(value);
}

function iso(value, field) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`First-purchase migration found invalid ${field}`);
  }
  return value.toISOString();
}

function optionalIso(value, field) {
  return value === undefined ? null : iso(value, field);
}

function canonicalKey(key) {
  return Object.entries(key ?? {}).map(([field, direction]) => [field, Number(direction)]);
}

function sameKey(left, right) {
  return stableStringify(canonicalKey(left)) === stableStringify(canonicalKey(right));
}

function samePartial(left, right) {
  return stableStringify(left ?? null) === stableStringify(right ?? null);
}

function indexSummary(index) {
  return {
    name: String(index.name),
    key: canonicalKey(index.key),
    unique: index.unique === true,
    partialFilterExpression: index.partialFilterExpression ?? null,
  };
}

function claimSummary(claim) {
  return {
    id: identity(claim._id),
    user: identity(claim.user),
    eligibilityClass: claim.eligibilityClass,
    status: claim.status,
    order: identity(claim.order),
    reservedAt: iso(claim.reservedAt, 'claim.reservedAt'),
    consumedAt: optionalIso(claim.consumedAt, 'claim.consumedAt'),
    releasedAt: optionalIso(claim.releasedAt, 'claim.releasedAt'),
  };
}

function eligibilitySummary(eligibility) {
  return {
    id: eligibility._id == null ? null : identity(eligibility._id),
    user: identity(eligibility.user),
    eligibilityClass: eligibility.eligibilityClass,
    status: eligibility.status,
    activeOrder: eligibility.activeOrder == null ? null : identity(eligibility.activeOrder),
    reservedAt: optionalIso(eligibility.reservedAt, 'eligibility.reservedAt'),
    consumedAt: optionalIso(eligibility.consumedAt, 'eligibility.consumedAt'),
    releasedAt: optionalIso(eligibility.releasedAt, 'eligibility.releasedAt'),
    version: eligibility.version ?? 0,
  };
}

function assertClaimShape(claim) {
  if (claim.eligibilityClass !== ELIGIBILITY_CLASS) {
    throw new Error(`Unsupported eligibility class on claim ${identity(claim._id)}`);
  }
  if (!['reserved', 'consumed', 'released', 'late_consumed'].includes(claim.status)) {
    throw new Error(`Unsupported status on claim ${identity(claim._id)}`);
  }
  identity(claim.user);
  identity(claim.order);
  iso(claim.reservedAt, 'claim.reservedAt');
  if (
    ['consumed', 'late_consumed'].includes(claim.status) &&
    (!(claim.consumedAt instanceof Date) || !Number.isFinite(claim.consumedAt.getTime()))
  ) {
    throw new Error(`Consumed claim ${identity(claim._id)} is missing consumedAt`);
  }
  if (
    claim.status === 'released' &&
    (!(claim.releasedAt instanceof Date) || !Number.isFinite(claim.releasedAt.getTime()))
  ) {
    throw new Error(`Released claim ${identity(claim._id)} is missing releasedAt`);
  }
}

function compareConsumedClaims(left, right) {
  const leftTime = /** @type {Date} */ (left.consumedAt).getTime();
  const rightTime = /** @type {Date} */ (right.consumedAt).getTime();
  if (leftTime !== rightTime) return leftTime - rightTime;
  const reservedDifference = left.reservedAt.getTime() - right.reservedAt.getTime();
  if (reservedDifference !== 0) return reservedDifference;
  return identity(left.order).localeCompare(identity(right.order));
}

/**
 * @param {FirstPurchaseClaim[]} claims
 * @returns {EligibilityTarget['desired']}
 */
function desiredEligibilityForClaims(claims) {
  for (const claim of claims) assertClaimShape(claim);
  const users = new Set(claims.map((claim) => identity(claim.user)));
  if (users.size !== 1)
    throw new Error('Eligibility derivation received claims from multiple users');

  const consumed = claims
    .filter((claim) => ['consumed', 'late_consumed'].includes(claim.status))
    .sort(compareConsumedClaims);
  if (consumed.length > 0) {
    const winner = consumed[0];
    return {
      user: winner.user,
      eligibilityClass: ELIGIBILITY_CLASS,
      status: 'consumed',
      activeOrder: winner.order,
      consumedAt: winner.consumedAt,
      version: 0,
    };
  }

  const reserved = claims.filter((claim) => claim.status === 'reserved');
  if (reserved.length > 1) {
    throw new Error(
      `Migration fail-closed: user ${identity(claims[0].user)} has ${reserved.length} active first-purchase reservations`,
    );
  }
  if (reserved.length === 1) {
    return {
      user: reserved[0].user,
      eligibilityClass: ELIGIBILITY_CLASS,
      status: 'reserved',
      activeOrder: reserved[0].order,
      reservedAt: reserved[0].reservedAt,
      version: 0,
    };
  }

  return {
    user: claims[0].user,
    eligibilityClass: ELIGIBILITY_CLASS,
    status: 'available',
    version: 0,
  };
}

function eligibilityMatches(existing, desired) {
  if (existing.eligibilityClass !== ELIGIBILITY_CLASS) return false;
  if (identity(existing.user) !== identity(desired.user)) return false;
  if (existing.status !== desired.status) return false;
  if ((existing.version ?? 0) < 0 || !Number.isInteger(existing.version ?? 0)) return false;
  if (
    (existing.activeOrder == null ? null : identity(existing.activeOrder)) !==
    (desired.activeOrder == null ? null : identity(desired.activeOrder))
  ) {
    return false;
  }
  if (
    (existing.reservedAt == null
      ? null
      : optionalIso(existing.reservedAt, 'eligibility.reservedAt')) !==
    (desired.reservedAt == null ? null : optionalIso(desired.reservedAt, 'desired.reservedAt'))
  ) {
    return false;
  }
  if (
    (existing.consumedAt == null
      ? null
      : optionalIso(existing.consumedAt, 'eligibility.consumedAt')) !==
    (desired.consumedAt == null ? null : optionalIso(desired.consumedAt, 'desired.consumedAt'))
  ) {
    return false;
  }
  return true;
}

/**
 * Deterministically derive singleton inserts and fail closed on conflicting existing state.
 * @param {FirstPurchaseClaim[]} claims
 * @param {FirstPurchaseEligibility[]} eligibilities
 * @returns {EligibilityTarget[]}
 */
export function buildFirstPurchaseEligibilityTargets(claims, eligibilities) {
  const claimsByUser = groupBy(claims, (claim) => identity(claim.user));
  const eligibilityByUser = groupBy(eligibilities, (entry) => identity(entry.user));
  for (const [userKey, rows] of eligibilityByUser) {
    if (rows.length > 1) {
      throw new Error(
        `Migration fail-closed: user ${userKey} has ${rows.length} eligibility singletons`,
      );
    }
  }

  /** @type {EligibilityTarget[]} */
  const targets = [];
  for (const [userKey, userClaims] of [...claimsByUser.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const desired = desiredEligibilityForClaims(userClaims);
    const existing = eligibilityByUser.get(userKey)?.[0];
    if (existing && !eligibilityMatches(existing, desired)) {
      throw new Error(
        `Migration fail-closed: singleton for user ${userKey} conflicts with claim history`,
      );
    }
    const sourceFingerprint = sha({
      claims: userClaims.map(claimSummary).sort((a, b) => a.id.localeCompare(b.id)),
      existing: existing ? eligibilitySummary(existing) : null,
      desired: eligibilitySummary(desired),
    });
    targets.push({
      user: desired.user,
      userKey,
      sourceFingerprint,
      desired,
      action: existing ? 'noop' : 'insert',
    });
  }
  return targets;
}

function indexesForKey(indexes, key) {
  return indexes.filter((index) => sameKey(index.key, key));
}

function classifyIndex(indexes, key, desired) {
  const matching = indexesForKey(indexes, key);
  if (matching.length > 1) {
    throw new Error(`Migration fail-closed: multiple indexes exist for ${stableStringify(key)}`);
  }
  if (matching.length === 0) return { action: 'create', current: null };
  const current = matching[0];
  const desiredMatch =
    current.unique === desired.unique &&
    samePartial(current.partialFilterExpression, desired.partialFilterExpression);
  return { action: desiredMatch ? 'noop' : 'replace', current: indexSummary(current) };
}

/**
 * @param {{
 *   claims: FirstPurchaseClaim[],
 *   eligibilities: FirstPurchaseEligibility[],
 *   claimIndexes: IndexDescription[],
 *   eligibilityIndexes: IndexDescription[],
 * }} source
 */
export function buildFirstPurchaseEligibilityMigrationPlan(source) {
  const targets = buildFirstPurchaseEligibilityTargets(source.claims, source.eligibilities);
  const claimUserClass = classifyIndex(source.claimIndexes, CLAIM_USER_CLASS_KEY, {
    unique: true,
    partialFilterExpression: { status: 'reserved' },
  });
  const claimOrder = classifyIndex(source.claimIndexes, CLAIM_ORDER_KEY, {
    unique: true,
    partialFilterExpression: undefined,
  });
  const eligibilityUserClass = classifyIndex(
    source.eligibilityIndexes,
    ELIGIBILITY_USER_CLASS_KEY,
    { unique: true, partialFilterExpression: undefined },
  );

  const duplicateOrders = groupBy(source.claims, (claim) => identity(claim.order));
  for (const [order, rows] of duplicateOrders) {
    if (rows.length > 1) {
      throw new Error(`Migration fail-closed: order ${order} has ${rows.length} claims`);
    }
  }

  const sourceFingerprint = sha({
    claims: source.claims.map(claimSummary).sort((a, b) => a.id.localeCompare(b.id)),
    eligibilities: source.eligibilities
      .map(eligibilitySummary)
      .sort((a, b) => a.user.localeCompare(b.user)),
    claimIndexes: source.claimIndexes
      .map(indexSummary)
      .sort((a, b) => a.name.localeCompare(b.name)),
    eligibilityIndexes: source.eligibilityIndexes
      .map(indexSummary)
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
  const actions = {
    backfillSingletons: targets.filter((target) => target.action === 'insert').length,
    claimUserClass: claimUserClass.action,
    claimOrder: claimOrder.action,
    eligibilityUserClass: eligibilityUserClass.action,
  };
  const planSha = sha({
    migration: MIGRATION_COMMENT,
    sourceFingerprint,
    actions,
    targetFingerprints: targets.map((target) => ({
      user: target.userKey,
      action: target.action,
      sourceFingerprint: target.sourceFingerprint,
    })),
  });
  return {
    sourceFingerprint,
    planSha,
    claimCount: source.claims.length,
    eligibilityCount: source.eligibilities.length,
    userCount: targets.length,
    actions,
    targets,
    currentClaimUserClassIndex: claimUserClass.current,
  };
}

export function validateFirstPurchaseEligibilityMigrationModes(options) {
  if (options.apply && options.verifyOnly) {
    throw new Error('--apply cannot be combined with --verify');
  }
  if (options.apply && !options.approvedPlanSha) {
    throw new Error('Apply requires --approve-plan=<planSha>');
  }
  if (options.apply && options.billingCreateDisabledConfirmed !== true) {
    throw new Error('Apply requires --confirm-billing-create-disabled');
  }
  if (!options.apply && options.approvedPlanSha) {
    throw new Error('--approve-plan requires --apply');
  }
  if (!options.apply && options.billingCreateDisabledConfirmed) {
    throw new Error('--confirm-billing-create-disabled requires --apply');
  }
}

export function validateFirstPurchaseEligibilityMigrationApproval(options) {
  if (!options.apply) return;
  if (options.approvedPlanSha !== options.plan.planSha) {
    throw new Error(
      `Approved plan SHA mismatch: expected ${options.plan.planSha}, got ${options.approvedPlanSha}`,
    );
  }
}

async function listIndexesOrEmpty(db, collectionName) {
  const collections = await db
    .listCollections({ name: collectionName }, { nameOnly: true })
    .toArray();
  if (collections.length === 0) return [];
  return db.collection(collectionName).listIndexes().toArray();
}

export async function inspectFirstPurchaseEligibilityMigration(db) {
  const [claims, eligibilities, claimIndexes, eligibilityIndexes] = await Promise.all([
    db
      .collection(CLAIMS_COLLECTION)
      .find(
        { eligibilityClass: ELIGIBILITY_CLASS },
        {
          projection: {
            user: 1,
            eligibilityClass: 1,
            status: 1,
            order: 1,
            reservedAt: 1,
            consumedAt: 1,
            releasedAt: 1,
          },
          sort: { user: 1, reservedAt: 1, _id: 1 },
        },
      )
      .toArray(),
    db
      .collection(ELIGIBILITIES_COLLECTION)
      .find(
        { eligibilityClass: ELIGIBILITY_CLASS },
        {
          projection: {
            user: 1,
            eligibilityClass: 1,
            status: 1,
            activeOrder: 1,
            reservedAt: 1,
            consumedAt: 1,
            releasedAt: 1,
            version: 1,
          },
          sort: { user: 1, _id: 1 },
        },
      )
      .toArray(),
    listIndexesOrEmpty(db, CLAIMS_COLLECTION),
    listIndexesOrEmpty(db, ELIGIBILITIES_COLLECTION),
  ]);
  return buildFirstPurchaseEligibilityMigrationPlan({
    claims,
    eligibilities,
    claimIndexes,
    eligibilityIndexes,
  });
}

async function assertTargetSourceUnchanged(db, target) {
  const [claims, existing] = await Promise.all([
    db
      .collection(CLAIMS_COLLECTION)
      .find(
        { user: target.user, eligibilityClass: ELIGIBILITY_CLASS },
        {
          projection: {
            user: 1,
            eligibilityClass: 1,
            status: 1,
            order: 1,
            reservedAt: 1,
            consumedAt: 1,
            releasedAt: 1,
          },
          sort: { reservedAt: 1, _id: 1 },
        },
      )
      .toArray(),
    db
      .collection(ELIGIBILITIES_COLLECTION)
      .findOne({ user: target.user, eligibilityClass: ELIGIBILITY_CLASS }),
  ]);
  const current = buildFirstPurchaseEligibilityTargets(claims, existing ? [existing] : [])[0];
  if (!current || current.sourceFingerprint !== target.sourceFingerprint) {
    throw new Error(`Conditional backfill failed: source changed for user ${target.userKey}`);
  }
}

async function ensureIndex(collection, key, options) {
  const indexes = await collection
    .listIndexes()
    .toArray()
    .catch((error) => {
      if (
        error &&
        typeof error === 'object' &&
        'codeName' in error &&
        error.codeName === 'NamespaceNotFound'
      ) {
        return [];
      }
      throw error;
    });
  const classification = classifyIndex(indexes, key, options);
  if (classification.action === 'noop') return false;
  if (classification.action === 'replace') {
    if (!classification.current) {
      throw new Error(`Index ${stableStringify(key)} replacement has no current index`);
    }
    await collection.dropIndex(classification.current.name, { comment: MIGRATION_COMMENT });
  }
  await collection.createIndex(key, { ...options, comment: MIGRATION_COMMENT });
  return true;
}

export async function applyFirstPurchaseEligibilityMigration(db, plan) {
  const eligibilities = db.collection(ELIGIBILITIES_COLLECTION);
  const claims = db.collection(CLAIMS_COLLECTION);

  await ensureIndex(eligibilities, ELIGIBILITY_USER_CLASS_KEY, {
    unique: true,
    name: ELIGIBILITY_INDEX_NAME,
  });

  let insertedSingletons = 0;
  for (const target of plan.targets) {
    if (target.action !== 'insert') continue;
    await assertTargetSourceUnchanged(db, target);
    try {
      const result = await eligibilities.insertOne(
        {
          ...target.desired,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { comment: MIGRATION_COMMENT },
      );
      if (!result.acknowledged) {
        throw new Error(`Singleton insert was not acknowledged for user ${target.userKey}`);
      }
      insertedSingletons += 1;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        throw new Error(
          `Conditional backfill failed: singleton appeared for user ${target.userKey}`,
        );
      }
      throw error;
    }
  }

  await ensureIndex(claims, CLAIM_ORDER_KEY, {
    unique: true,
    name: CLAIM_ORDER_INDEX_NAME,
  });

  await ensureIndex(claims, CLAIM_USER_CLASS_KEY, {
    unique: true,
    partialFilterExpression: { status: 'reserved' },
    name: CLAIM_ACTIVE_INDEX_NAME,
  });

  return { insertedSingletons };
}

export async function verifyFirstPurchaseEligibilityPostcondition(db) {
  const plan = await inspectFirstPurchaseEligibilityMigration(db);
  const pending =
    plan.actions.backfillSingletons > 0 ||
    plan.actions.claimUserClass !== 'noop' ||
    plan.actions.claimOrder !== 'noop' ||
    plan.actions.eligibilityUserClass !== 'noop';
  if (pending) {
    throw new Error(
      `Postcondition failed: migration still has pending actions ${stableStringify(plan.actions)}`,
    );
  }
  return {
    verified: true,
    claimCount: plan.claimCount,
    eligibilityCount: plan.eligibilityCount,
    userCount: plan.userCount,
    planSha: plan.planSha,
  };
}

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
  const billingCreateDisabledConfirmed = process.argv.includes('--confirm-billing-create-disabled');
  validateFirstPurchaseEligibilityMigrationModes({
    apply,
    verifyOnly,
    ...(approvedPlanSha ? { approvedPlanSha } : {}),
    billingCreateDisabledConfirmed,
  });

  if (apply && process.env.PAYOS_CREATE_ENABLED?.trim().toLowerCase() === 'true') {
    throw new Error(
      'Apply is blocked while PAYOS_CREATE_ENABLED=true; disable billing create before migration',
    );
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    const db = client.db();
    if (verifyOnly) {
      const verification = await verifyFirstPurchaseEligibilityPostcondition(db);
      process.stdout.write(
        `${JSON.stringify({ mode: 'verify', databaseName: db.databaseName, ...verification }, null, 2)}\n`,
      );
      return;
    }

    const plan = await inspectFirstPurchaseEligibilityMigration(db);
    validateFirstPurchaseEligibilityMigrationApproval({
      apply,
      ...(approvedPlanSha ? { approvedPlanSha } : {}),
      plan,
    });
    if (!apply) {
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'dry-run',
            databaseName: db.databaseName,
            sourceFingerprint: plan.sourceFingerprint,
            planSha: plan.planSha,
            claimCount: plan.claimCount,
            eligibilityCount: plan.eligibilityCount,
            userCount: plan.userCount,
            actions: plan.actions,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    const replan = await inspectFirstPurchaseEligibilityMigration(db);
    if (replan.planSha !== plan.planSha) {
      throw new Error(
        `Plan changed between approve and apply: expected ${plan.planSha}, re-inspect ${replan.planSha}`,
      );
    }
    const result = await applyFirstPurchaseEligibilityMigration(db, replan);
    const verification = await verifyFirstPurchaseEligibilityPostcondition(db);
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'apply',
          databaseName: db.databaseName,
          sourceFingerprint: plan.sourceFingerprint,
          planSha: plan.planSha,
          ...result,
          verification,
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
