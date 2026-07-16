import { readFile } from 'node:fs/promises';

import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

import {
  CliUsageError,
  isIndexApplyMode,
  parseIndexCliArgs,
  readModeExitCode,
  selectIndexActionsForMode,
  validatePartialApplyRemainder,
  validateSensitiveApproval,
} from './database/index-cli.mjs';
import { INDEX_CONTRACT, INDEX_CONTRACT_VERSION } from './database/index-contract.mjs';
import { buildIndexPlan, isApplicableAction } from './database/index-planner.mjs';

config({ path: '.env', quiet: true });

class MigrationSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MigrationSafetyError';
  }
}

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
let cli;
let maxTimeMS = 120_000;
let client;

try {
  cli = parseIndexCliArgs(process.argv.slice(2), process.env);
  maxTimeMS = parsePositiveInteger(process.env.INDEX_MIGRATION_MAX_TIME_MS, 120_000);
  if (!uri) throw new CliUsageError('Missing MongoDB connection string');

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  const db = client.db();
  const plan = await createCurrentPlan(db);

  if (!isIndexApplyMode(cli.mode)) {
    emit({ mode: cli.mode, ...plan });
    process.exitCode = readModeExitCode(cli.mode, plan);
  } else {
    const result = await applyPlan(db, plan, cli);
    emit(result);
    if (result.productionContractVerified !== true) process.exitCode = 2;
  }
} catch (error) {
  emitError(error, cli?.mode ?? 'unknown');
  process.exitCode =
    error instanceof CliUsageError ? 3 : error instanceof MigrationSafetyError ? 2 : 1;
} finally {
  await client?.close();
}

async function createCurrentPlan(db) {
  const actualIndexesByCollection = await readActualIndexes(db);
  return buildIndexPlan({
    contract: INDEX_CONTRACT,
    contractVersion: INDEX_CONTRACT_VERSION,
    actualIndexesByCollection,
    databaseName: db.databaseName,
  });
}

async function readActualIndexes(db) {
  const managedCollections = [...new Set(INDEX_CONTRACT.map((entry) => entry.collection))].sort();
  const existingCollections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((entry) => entry.name),
  );
  const snapshot = {};

  for (const collectionName of managedCollections) {
    snapshot[collectionName] = existingCollections.has(collectionName)
      ? await db.collection(collectionName).listIndexes().toArray()
      : [];
  }
  return snapshot;
}

async function applyPlan(db, plan, options) {
  if (!options.planSha) {
    throw new CliUsageError('Apply requires --plan-sha (or INDEX_PLAN_SHA) from a fresh plan');
  }
  if (options.planSha.toLowerCase() !== plan.planSha.toLowerCase()) {
    throw new MigrationSafetyError(
      `Plan SHA mismatch: expected ${options.planSha}, current database plan is ${plan.planSha}`,
    );
  }
  if (plan.manualCount > 0) {
    throw new MigrationSafetyError(
      `Plan contains ${plan.manualCount} non-automatic action(s); resolve them before apply`,
    );
  }

  const plannedActions = selectIndexActionsForMode(plan, options.mode, options.actionTypes);

  if (options.mode === 'apply' || options.mode === 'apply-selected') {
    const approval = await loadApproval(options.approvalFile);
    const approvalIssues = validateSensitiveApproval({
      approval,
      plan: options.mode === 'apply' ? plan : { ...plan, actions: plannedActions },
    });
    if (approvalIssues.length > 0) {
      throw new MigrationSafetyError(approvalIssues.join('; '));
    }
  }

  const execution = [];
  const sourceFingerprints = new Set(plan.actions.map((action) => action.fingerprint));
  const selectedFingerprints = plannedActions.map((action) => action.fingerprint);
  for (const plannedAction of plannedActions) {
    if (!isApplicableAction(plannedAction)) {
      throw new MigrationSafetyError(`Unsupported automatic action: ${plannedAction.type}`);
    }

    const currentPlan = await createCurrentPlan(db);
    if (currentPlan.manualCount > 0) {
      throw new MigrationSafetyError('Database state changed to require manual reconciliation');
    }
    const unapprovedDrift = currentPlan.actions.filter(
      (candidate) => !sourceFingerprints.has(candidate.fingerprint),
    );
    if (unapprovedDrift.length > 0) {
      throw new MigrationSafetyError(
        'Database state changed after planning; generate and approve a new plan',
      );
    }
    const currentAction = currentPlan.actions.find(
      (candidate) => candidate.fingerprint === plannedAction.fingerprint,
    );
    if (!currentAction) {
      const conflictingAction = currentPlan.actions.find(
        (candidate) =>
          candidate.collection === plannedAction.collection &&
          candidate.indexId === plannedAction.indexId,
      );
      if (conflictingAction) {
        throw new MigrationSafetyError(
          `Precondition changed for ${plannedAction.indexId}; generate a new plan`,
        );
      }
      execution.push({
        fingerprint: plannedAction.fingerprint,
        indexId: plannedAction.indexId,
        action: plannedAction.type,
        result: 'already_satisfied',
      });
      continue;
    }

    await executeAction(db, currentAction);
    execution.push({
      fingerprint: currentAction.fingerprint,
      indexId: currentAction.indexId,
      action: currentAction.type,
      result: 'applied',
    });
  }

  const verification = await createCurrentPlan(db);
  if (options.mode === 'apply' && verification.blockingCount > 0) {
    throw new MigrationSafetyError(
      `Post-apply verification found ${verification.blockingCount} remaining drift action(s)`,
    );
  }
  if (options.mode === 'apply-safe-only' || options.mode === 'apply-selected') {
    const verificationIssues = validatePartialApplyRemainder({
      sourcePlan: plan,
      verificationPlan: verification,
      selectedFingerprints,
    });
    if (verificationIssues.length > 0) {
      throw new MigrationSafetyError(verificationIssues.join('; '));
    }
  }

  const productionContractVerified = verification.blockingCount === 0;
  const hasRemainingSafeActions = verification.actions.some((action) => action.sensitive !== true);

  return {
    mode: options.mode,
    status: productionContractVerified
      ? 'verified'
      : hasRemainingSafeActions
        ? 'additional_safe_actions_pending'
        : 'sensitive_approval_required',
    sourcePlanSha: plan.planSha,
    verificationPlanSha: verification.planSha,
    selectedActionsVerified: true,
    allSafeActionsVerified: !hasRemainingSafeActions,
    productionContractVerified,
    actionTypeFilter: options.actionTypes,
    execution,
    verification,
  };
}

async function executeAction(db, plannedAction) {
  const collection = db.collection(plannedAction.collection);

  if (plannedAction.type === 'create') {
    if (plannedAction.options?.unique === true) {
      const duplicate = await findDuplicateForUniqueIndex(collection, plannedAction);
      if (duplicate) {
        throw new MigrationSafetyError(
          `Cannot create unique index ${plannedAction.indexId}: duplicate key group exists`,
        );
      }
    }
    await collection.createIndex(plannedAction.key, createIndexOptions(plannedAction));
    return;
  }

  if (plannedAction.type === 'hide' || plannedAction.type === 'unhide') {
    if (!plannedAction.actualName) {
      throw new MigrationSafetyError(`${plannedAction.type} requires an existing index name`);
    }
    await db.command({
      collMod: plannedAction.collection,
      index: {
        name: plannedAction.actualName,
        hidden: plannedAction.type === 'hide',
      },
    });
    return;
  }

  if (plannedAction.type === 'update_ttl') {
    const expireAfterSeconds = plannedAction.options?.expireAfterSeconds;
    if (
      !plannedAction.actualName ||
      !Number.isFinite(expireAfterSeconds) ||
      expireAfterSeconds < 0 ||
      expireAfterSeconds > 2_147_483_647
    ) {
      throw new MigrationSafetyError(
        'update_ttl requires an existing index name and a supported expireAfterSeconds',
      );
    }
    await db.command({
      collMod: plannedAction.collection,
      index: {
        name: plannedAction.actualName,
        expireAfterSeconds,
      },
    });
    return;
  }

  if (plannedAction.type === 'drop') {
    if (!plannedAction.actualName) {
      throw new MigrationSafetyError('drop requires an existing index name');
    }
    await collection.dropIndex(plannedAction.actualName);
    return;
  }

  throw new MigrationSafetyError(`Unhandled action type: ${plannedAction.type}`);
}

async function findDuplicateForUniqueIndex(collection, plannedAction) {
  const fields = Object.keys(plannedAction.key);
  const matchClauses = [];
  if (plannedAction.options?.partialFilterExpression) {
    matchClauses.push(plannedAction.options.partialFilterExpression);
  }
  if (plannedAction.options?.sparse === true) {
    matchClauses.push({ $or: fields.map((field) => ({ [field]: { $exists: true } })) });
  }

  const pipeline = [];
  if (matchClauses.length === 1) pipeline.push({ $match: matchClauses[0] });
  if (matchClauses.length > 1) pipeline.push({ $match: { $and: matchClauses } });
  pipeline.push(
    {
      $group: {
        _id: Object.fromEntries(fields.map((field, index) => [`field${index}`, `$${field}`])),
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  );

  const [duplicate] = await collection
    .aggregate(pipeline, {
      allowDiskUse: false,
      maxTimeMS,
      ...(plannedAction.options?.collation ? { collation: plannedAction.options.collation } : {}),
    })
    .toArray();
  return duplicate ?? null;
}

function createIndexOptions(plannedAction) {
  const source = plannedAction.options ?? {};
  const options = {};
  const supported = [
    'collation',
    'default_language',
    'expireAfterSeconds',
    'language_override',
    'partialFilterExpression',
    'sparse',
    'unique',
    'weights',
    'wildcardProjection',
  ];
  for (const key of supported) {
    if (source[key] !== undefined && source[key] !== false && source[key] !== null) {
      options[key] = source[key];
    }
  }
  if (plannedAction.contractName) options.name = plannedAction.contractName;
  return options;
}

async function loadApproval(approvalFile) {
  if (!approvalFile) return null;
  let source;
  try {
    source = await readFile(approvalFile, 'utf8');
  } catch (error) {
    throw new CliUsageError(
      `Cannot read approval file ${approvalFile}: ${error instanceof Error ? error.message : error}`,
    );
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new CliUsageError(
      `Approval file is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CliUsageError('INDEX_MIGRATION_MAX_TIME_MS must be a positive integer');
  }
  return parsed;
}

function emit(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function emitError(error, mode) {
  console.error(
    JSON.stringify(
      {
        mode,
        status: 'error',
        error: {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
        },
      },
      null,
      2,
    ),
  );
}
