import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import {
  retainRecentReviewHistory,
  retainRecentWeeklyActivity,
} from '../src/lib/learning-progress-retention.mjs';

const { loadEnvConfig } = nextEnv;
const DEFAULT_MAX_DOCUMENTS = 1_000;
const NORMALIZATION_COMMENT = 'normalize-learning-progress-contracts-v2';

export function buildLearningProgressNormalizationPlan({ userProgressRows, questionProgressRows }) {
  const userActions = userProgressRows.flatMap((row) => {
    const set = {};
    const guards = {};
    let weeklyActivityEntriesRemoved = 0;

    if (!Object.hasOwn(row, 'lastSessionDate')) {
      set.lastSessionDate = null;
      guards.lastSessionDateMissing = true;
    }

    const weeklyActivityMissing =
      !Object.hasOwn(row, 'weeklyActivity') || row.weeklyActivity == null;
    const originalWeeklyActivity = weeklyActivityMissing ? {} : row.weeklyActivity;
    const activityEntries = readActivityEntries(originalWeeklyActivity, row._id);
    let retainedActivityEntries = activityEntries;

    if (activityEntries.length > 0) {
      retainedActivityEntries = [
        ...retainRecentWeeklyActivity(
          activityEntries,
          requireValidDate(row.lastActiveDate, row._id),
        ),
      ].sort(([dayA], [dayB]) => dayA.localeCompare(dayB));
    }

    weeklyActivityEntriesRemoved = activityEntries.length - retainedActivityEntries.length;
    if (weeklyActivityMissing || weeklyActivityEntriesRemoved > 0) {
      set.weeklyActivity = Object.fromEntries(retainedActivityEntries);
      guards.weeklyActivity = weeklyActivityMissing ? { $exists: false } : originalWeeklyActivity;
    }

    if (Object.keys(set).length === 0) return [];
    return [
      {
        id: row._id,
        set,
        guards,
        weeklyActivityEntriesRemoved,
        normalizedMissingWeeklyActivity: weeklyActivityMissing,
        normalizedMissingLastSessionDate: !Object.hasOwn(row, 'lastSessionDate'),
      },
    ];
  });

  const questionActions = questionProgressRows.flatMap((row) => {
    const historyMissing = !Object.hasOwn(row, 'history') || row.history == null;
    if (!historyMissing && !Array.isArray(row.history)) {
      throw new TypeError(`Question progress ${String(row._id)} has a non-array history`);
    }

    const originalHistory = historyMissing ? [] : row.history;
    const retainedHistory = retainRecentReviewHistory(originalHistory);
    const reviewHistoryEntriesRemoved = originalHistory.length - retainedHistory.length;
    if (!historyMissing && reviewHistoryEntriesRemoved === 0) return [];

    return [
      {
        id: row._id,
        set: { history: retainedHistory },
        historyGuard: historyMissing ? { $exists: false } : originalHistory,
        normalizedMissingHistory: historyMissing,
        reviewHistoryEntriesRemoved,
      },
    ];
  });

  userActions.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  questionActions.sort((left, right) => String(left.id).localeCompare(String(right.id)));

  const summary = {
    userProgressDocuments: userActions.length,
    questionProgressDocuments: questionActions.length,
    totalDocuments: userActions.length + questionActions.length,
    missingLastSessionDates: userActions.filter(
      ({ normalizedMissingLastSessionDate }) => normalizedMissingLastSessionDate,
    ).length,
    missingWeeklyActivity: userActions.filter(
      ({ normalizedMissingWeeklyActivity }) => normalizedMissingWeeklyActivity,
    ).length,
    weeklyActivityEntriesRemoved: userActions.reduce(
      (total, { weeklyActivityEntriesRemoved }) => total + weeklyActivityEntriesRemoved,
      0,
    ),
    missingReviewHistory: questionActions.filter(
      ({ normalizedMissingHistory }) => normalizedMissingHistory,
    ).length,
    reviewHistoryEntriesRemoved: questionActions.reduce(
      (total, { reviewHistoryEntriesRemoved }) => total + reviewHistoryEntriesRemoved,
      0,
    ),
  };

  const planSha = createHash('sha256')
    .update(
      JSON.stringify(
        canonicalize({
          userActions: userActions.map(({ id, set }) => ({ id: String(id), set })),
          questionActions: questionActions.map(({ id, set }) => ({ id: String(id), set })),
        }),
      ),
    )
    .digest('hex');

  return { userActions, questionActions, summary, planSha };
}

export function validateLearningProgressNormalization({
  apply,
  approvedPlanSha,
  maxDocuments,
  plan,
}) {
  if (!Number.isSafeInteger(maxDocuments) || maxDocuments < 1) {
    throw new Error('--max-documents must be a positive safe integer');
  }
  if (!apply || plan.summary.totalDocuments === 0) return;
  if (plan.summary.totalDocuments > maxDocuments) {
    throw new Error(
      `Normalization plan contains ${plan.summary.totalDocuments} documents, above the --max-documents limit of ${maxDocuments}`,
    );
  }
  if (!approvedPlanSha) {
    throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
  }
  if (approvedPlanSha !== plan.planSha) {
    throw new Error('Approved plan SHA does not match the current normalization plan');
  }
}

export async function inspectLearningProgressNormalization(db) {
  const collectionNames = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  if (!collectionNames.has('userprogresses') || !collectionNames.has('questionprogresses')) {
    throw new Error('Both userprogresses and questionprogresses collections are required');
  }

  const [userProgressRows, questionProgressRows] = await Promise.all([
    db
      .collection('userprogresses')
      .find({}, { projection: { lastSessionDate: 1, lastActiveDate: 1, weeklyActivity: 1 } })
      .toArray(),
    db
      .collection('questionprogresses')
      .find({}, { projection: { history: 1 } })
      .toArray(),
  ]);

  return buildLearningProgressNormalizationPlan({ userProgressRows, questionProgressRows });
}

async function applyLearningProgressNormalization(db, plan) {
  const userResult = await applyActions(
    db.collection('userprogresses'),
    plan.userActions.map((action) => ({
      updateOne: {
        filter: {
          _id: action.id,
          ...(action.guards.lastSessionDateMissing ? { lastSessionDate: { $exists: false } } : {}),
          ...(Object.hasOwn(action.guards, 'weeklyActivity')
            ? { weeklyActivity: action.guards.weeklyActivity }
            : {}),
        },
        update: { $set: action.set },
      },
    })),
  );
  const questionResult = await applyActions(
    db.collection('questionprogresses'),
    plan.questionActions.map((action) => ({
      updateOne: {
        filter: { _id: action.id, history: action.historyGuard },
        update: { $set: action.set },
      },
    })),
  );

  assertAppliedExactly(userResult, plan.userActions.length, 'user progress');
  assertAppliedExactly(questionResult, plan.questionActions.length, 'question progress');

  const verification = await inspectLearningProgressNormalization(db);
  if (verification.summary.totalDocuments !== 0) {
    throw new Error(
      `Post-apply verification found ${verification.summary.totalDocuments} learning progress documents still requiring normalization`,
    );
  }

  return {
    userProgressModified: userResult.modifiedCount,
    questionProgressModified: questionResult.modifiedCount,
    verified: true,
  };
}

async function applyActions(collection, operations) {
  if (operations.length === 0) return { matchedCount: 0, modifiedCount: 0 };
  return collection.bulkWrite(operations, {
    ordered: true,
    comment: NORMALIZATION_COMMENT,
  });
}

function assertAppliedExactly(result, expected, label) {
  if (result.matchedCount !== expected || result.modifiedCount !== expected) {
    throw new Error(
      `Normalized ${result.modifiedCount}/${expected} ${label} documents after matching ${result.matchedCount}; source data changed after plan approval`,
    );
  }
}

function readActivityEntries(value, id) {
  if (value instanceof Map) return [...value.entries()];
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`User progress ${String(id)} has invalid weeklyActivity data`);
  }
  return Object.entries(value);
}

function requireValidDate(value, id) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(
      `User progress ${String(id)} requires a valid lastActiveDate before activity pruning`,
    );
  }
  return date;
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
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
  const approvedPlanSha = readOption('approve-plan');
  const maxDocumentsRaw = readOption('max-documents');
  const maxDocuments =
    maxDocumentsRaw === undefined ? DEFAULT_MAX_DOCUMENTS : Number(maxDocumentsRaw);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db();
    const plan = await inspectLearningProgressNormalization(db);
    validateLearningProgressNormalization({
      apply,
      approvedPlanSha,
      maxDocuments,
      plan,
    });
    const execution = apply
      ? await applyLearningProgressNormalization(db, plan)
      : {
          userProgressModified: 0,
          questionProgressModified: 0,
          verified: undefined,
        };

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          databaseName: db.databaseName,
          planSha: plan.planSha,
          maxDocuments,
          ...plan.summary,
          ...execution,
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
