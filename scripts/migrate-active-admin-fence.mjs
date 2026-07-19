import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import { verifyUserDisablePostcondition } from './migrate-user-disable-state.mjs';

const { loadEnvConfig } = nextEnv;

const FENCE_ID = 'active-admin';
const FENCE_COLLECTION = 'adminmutationfences';
const USERS_COLLECTION = 'users';
const MIGRATION_COMMENT = 'migrate-active-admin-fence-v1';
const ACTIVE = 0;

/**
 * @typedef {{
 *   mode: 'create' | 'noop',
 *   activeAdminCount: number,
 *   activeAdminIds: string[],
 *   fenceState: null | { revision: number, updatedAt: string | null, canonical: boolean },
 *   sourceFingerprint: string,
 *   planSha: string,
 * }} ActiveAdminFencePlan
 *
 * @typedef {{
 *   find(
 *     filter: Record<string, unknown>,
 *     options: Record<string, unknown>,
 *   ): { toArray(): Promise<Array<{
 *     _id?: unknown,
 *     disable?: unknown,
 *     authVersion?: unknown,
 *     disabledAt?: unknown,
 *     disabledBy?: unknown,
 *   }>> },
 *   countDocuments(filter: Record<string, unknown>): Promise<number>,
 *   findOne(filter: Record<string, unknown>): Promise<object | null>,
 *   insertOne(
 *     document: Record<string, unknown>,
 *     options: Record<string, unknown>,
 *   ): Promise<{ acknowledged: boolean, insertedId: unknown }>,
 * }} ActiveAdminFenceMigrationCollection
 *
 * @typedef {{
 *   collection(name: string): ActiveAdminFenceMigrationCollection,
 * }} ActiveAdminFenceMigrationDb
 */

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * @param {unknown} value
 * @returns {value is Date}
 */
export function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * Canonical fence: exact singleton id, nonnegative integer revision, Date updatedAt.
 * @param {Record<string, unknown> | null | undefined} doc
 */
export function isCanonicalFence(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (doc._id !== FENCE_ID) return false;
  if (!isNonNegativeInteger(doc.revision)) return false;
  if (!isValidDate(doc.updatedAt)) return false;
  return true;
}

/**
 * Malformed when a document exists at the fence id but is not canonical.
 * @param {Record<string, unknown> | null | undefined} doc
 */
export function isMalformedFence(doc) {
  if (doc == null) return false;
  return !isCanonicalFence(doc);
}

/**
 * Stable fingerprint: sorted active-admin ids + fence state (order independent).
 * Never includes secrets or connection strings.
 * @param {string[]} activeAdminIds
 * @param {Record<string, unknown> | null} fenceDoc
 */
export function createSourceFingerprint(activeAdminIds, fenceDoc) {
  const sortedIds = [...activeAdminIds].map(String).sort((a, b) => a.localeCompare(b));
  /** @type {null | { revision: number, updatedAt: string | null, canonical: boolean }} */
  let fenceState = null;
  if (fenceDoc != null) {
    fenceState = {
      revision: isNonNegativeInteger(fenceDoc.revision) ? fenceDoc.revision : -1,
      updatedAt: isValidDate(fenceDoc.updatedAt)
        ? fenceDoc.updatedAt.toISOString()
        : fenceDoc.updatedAt == null
          ? null
          : String(fenceDoc.updatedAt),
      canonical: isCanonicalFence(fenceDoc),
    };
  }
  const payload = {
    fenceId: FENCE_ID,
    activeAdminIds: sortedIds,
    fenceState,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * @param {{
 *   mode: 'create' | 'noop',
 *   sourceFingerprint: string,
 *   activeAdminCount: number,
 * }} input
 */
export function createActiveAdminFencePlanSha(input) {
  const payload = {
    migration: MIGRATION_COMMENT,
    mode: input.mode,
    fenceId: FENCE_ID,
    initialRevision: 0,
    sourceFingerprint: input.sourceFingerprint,
    activeAdminCount: input.activeAdminCount,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Build a deterministic plan from inspected active admins + fence document.
 * Fails closed on zero active admins or malformed existing fence.
 *
 * @param {Array<{ _id: unknown }>} activeAdmins
 * @param {Record<string, unknown> | null} fenceDoc
 * @returns {ActiveAdminFencePlan}
 */
export function buildActiveAdminFencePlan(activeAdmins, fenceDoc) {
  const activeAdminIds = activeAdmins.map((doc) => String(doc._id));
  const activeAdminCount = activeAdminIds.length;

  if (activeAdminCount === 0) {
    throw new Error(
      'Active-admin fence migration failed: zero active admins (role=admin, disable=0)',
    );
  }

  if (isMalformedFence(fenceDoc)) {
    throw new Error(
      'Active-admin fence migration failed: existing fence document is malformed (not canonical)',
    );
  }

  const sourceFingerprint = createSourceFingerprint(activeAdminIds, fenceDoc);
  const mode = fenceDoc == null ? 'create' : 'noop';
  const planSha = createActiveAdminFencePlanSha({
    mode,
    sourceFingerprint,
    activeAdminCount,
  });

  /** @type {ActiveAdminFencePlan['fenceState']} */
  let fenceState = null;
  if (fenceDoc != null) {
    fenceState = {
      revision: /** @type {number} */ (fenceDoc.revision),
      updatedAt: isValidDate(fenceDoc.updatedAt) ? fenceDoc.updatedAt.toISOString() : null,
      canonical: true,
    };
  }

  return {
    mode,
    activeAdminCount,
    activeAdminIds: [...activeAdminIds].sort((a, b) => a.localeCompare(b)),
    fenceState,
    sourceFingerprint,
    planSha,
  };
}

/**
 * @param {{
 *   apply: boolean,
 *   verifyOnly?: boolean,
 *   approvedPlanSha?: string,
 * }} modes
 */
export function validateActiveAdminFenceMigrationModes(modes) {
  if (modes.apply && modes.verifyOnly) {
    throw new Error('Cannot combine --apply and --verify');
  }
  if (modes.apply && !modes.approvedPlanSha) {
    throw new Error('Apply requires --approve-plan=<planSha>');
  }
  if (!modes.apply && modes.approvedPlanSha) {
    throw new Error('--approve-plan is only valid with --apply');
  }
}

/**
 * @param {{
 *   apply: boolean,
 *   approvedPlanSha?: string,
 *   plan: ActiveAdminFencePlan,
 * }} input
 */
export function validateActiveAdminFenceMigration(input) {
  if (!input.apply) return;
  if (!input.approvedPlanSha) {
    throw new Error(`Apply requires --approve-plan=${input.plan.planSha}`);
  }
  if (input.approvedPlanSha !== input.plan.planSha) {
    throw new Error(
      `Approved plan SHA mismatch: expected ${input.plan.planSha}, got ${input.approvedPlanSha}`,
    );
  }
}

/**
 * @param {ActiveAdminFenceMigrationDb} db
 */
export async function inspectActiveAdminFenceMigration(db) {
  await verifyUserDisablePostcondition(db);

  const activeAdmins = await db
    .collection(USERS_COLLECTION)
    .find({ role: 'admin', disable: ACTIVE }, { projection: { _id: 1 }, sort: { _id: 1 } })
    .toArray();

  const fenceDoc = await db.collection(FENCE_COLLECTION).findOne({ _id: FENCE_ID });
  return buildActiveAdminFencePlan(
    activeAdmins,
    /** @type {Record<string, unknown> | null} */ (fenceDoc),
  );
}

/**
 * Conditional insert without upsert. Caller must re-inspect first.
 * @param {ActiveAdminFenceMigrationDb} db
 * @param {ActiveAdminFencePlan} plan
 * @param {Date} [now]
 */
export async function applyActiveAdminFenceCreate(db, plan, now = new Date()) {
  if (plan.mode !== 'create') {
    return { inserted: false, reason: 'noop' };
  }

  const collection = db.collection(FENCE_COLLECTION);
  const existing = await collection.findOne({ _id: FENCE_ID });
  if (existing != null) {
    throw new Error('Conditional create failed: fence document already exists');
  }

  try {
    const result = await collection.insertOne(
      {
        _id: FENCE_ID,
        revision: 0,
        updatedAt: now,
      },
      { comment: MIGRATION_COMMENT },
    );
    if (!result.acknowledged || result.insertedId !== FENCE_ID) {
      throw new Error('Conditional create failed: insert was not acknowledged for active-admin');
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      /** @type {{ code?: number }} */ (error).code === 11000
    ) {
      throw new Error('Conditional create failed: duplicate key on active-admin fence');
    }
    throw error;
  }

  return { inserted: true, reason: 'created' };
}

/**
 * Verify requires canonical fence and at least one active admin.
 * @param {ActiveAdminFenceMigrationDb} db
 */
export async function verifyActiveAdminFencePostcondition(db) {
  await verifyUserDisablePostcondition(db);

  const activeAdminCount = await db
    .collection(USERS_COLLECTION)
    .countDocuments({ role: 'admin', disable: ACTIVE });
  if (activeAdminCount < 1) {
    throw new Error(
      `Postcondition failed: expected at least one active admin, found ${activeAdminCount}`,
    );
  }

  const fenceDoc = await db.collection(FENCE_COLLECTION).findOne({ _id: FENCE_ID });
  if (!isCanonicalFence(/** @type {Record<string, unknown> | null} */ (fenceDoc))) {
    throw new Error('Postcondition failed: active-admin fence missing or not canonical');
  }

  return {
    verified: true,
    activeAdminCount,
    fenceRevision: /** @type {{ revision: number }} */ (fenceDoc).revision,
  };
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

  validateActiveAdminFenceMigrationModes({
    apply,
    verifyOnly,
    ...(approvedPlanSha !== undefined ? { approvedPlanSha } : {}),
  });

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db();

    if (verifyOnly) {
      const verification = await verifyActiveAdminFencePostcondition(db);
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

    const plan = await inspectActiveAdminFenceMigration(db);
    validateActiveAdminFenceMigration({
      apply,
      ...(approvedPlanSha !== undefined ? { approvedPlanSha } : {}),
      plan,
    });

    let applied = false;
    let verified = undefined;

    if (apply) {
      // Re-inspect immediately before create; plan SHA must still match approval.
      const replan = await inspectActiveAdminFenceMigration(db);
      if (replan.planSha !== plan.planSha) {
        throw new Error(
          `Plan changed between approve and apply: expected ${plan.planSha}, re-inspect ${replan.planSha}`,
        );
      }
      if (replan.mode === 'create') {
        await applyActiveAdminFenceCreate(db, replan);
        applied = true;
      }
      const verification = await verifyActiveAdminFencePostcondition(db);
      verified = true;

      // Idempotent: second plan after apply must be noop with canonical fence.
      const postPlan = await inspectActiveAdminFenceMigration(db);
      if (postPlan.mode !== 'noop') {
        throw new Error(`Post-apply plan mode is not noop: ${postPlan.mode}`);
      }

      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'apply',
            databaseName: db.databaseName,
            planMode: plan.mode,
            sourceFingerprint: plan.sourceFingerprint,
            planSha: plan.planSha,
            applied,
            verified,
            activeAdminCount: verification.activeAdminCount,
            fenceRevision: verification.fenceRevision,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    // Dry-run default: deterministic fingerprints, no secrets.
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'dry-run',
          databaseName: db.databaseName,
          planMode: plan.mode,
          activeAdminCount: plan.activeAdminCount,
          sourceFingerprint: plan.sourceFingerprint,
          planSha: plan.planSha,
          fenceState: plan.fenceState,
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
