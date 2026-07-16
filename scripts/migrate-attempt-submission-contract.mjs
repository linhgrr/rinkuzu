import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';

const { loadEnvConfig } = nextEnv;
const DEFAULT_MAX_DELETE = 100;
const MIGRATION_COMMENT = 'migrate-attempt-submission-contract-v1';

function readOption(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function selectedAnswer(question, answer) {
  if (question.type === 'single') {
    if (answer?.kind !== 'single') throw new TypeError('single answer kind mismatch');
    if (answer.selectedIndex === null) return -1;
    if (
      !Number.isInteger(answer.selectedIndex) ||
      answer.selectedIndex < 0 ||
      answer.selectedIndex >= question.options.length
    ) {
      throw new TypeError('single answer index is invalid');
    }
    return answer.selectedIndex;
  }

  if (question.type !== 'multiple' || answer?.kind !== 'multiple') {
    throw new TypeError('multiple answer kind mismatch');
  }
  if (
    !Array.isArray(answer.selectedIndexes) ||
    answer.selectedIndexes.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= question.options.length,
    ) ||
    new Set(answer.selectedIndexes).size !== answer.selectedIndexes.length
  ) {
    throw new TypeError('multiple answer indexes are invalid');
  }
  return answer.selectedIndexes.toSorted((left, right) => left - right);
}

function isCorrectAnswer(question, answer) {
  if (question.type === 'single') {
    if (
      !Number.isInteger(question.correctIndex) ||
      question.correctIndex < 0 ||
      question.correctIndex >= question.options.length
    ) {
      throw new TypeError('single correct index is invalid');
    }
    return answer === question.correctIndex;
  }

  if (
    !Array.isArray(question.correctIndexes) ||
    question.correctIndexes.length === 0 ||
    question.correctIndexes.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= question.options.length,
    ) ||
    new Set(question.correctIndexes).size !== question.correctIndexes.length
  ) {
    throw new TypeError('multiple correct indexes are invalid');
  }
  const correctIndexes = question.correctIndexes.toSorted((left, right) => left - right);
  return (
    Array.isArray(answer) &&
    answer.length === correctIndexes.length &&
    answer.every((index, position) => index === correctIndexes[position])
  );
}

function canonicalFields(attempt) {
  const questions = attempt.quizSnapshot?.questions;
  if (
    attempt.quizSnapshot?.integrity !== 'complete' ||
    !Array.isArray(questions) ||
    !questions.length
  ) {
    throw new TypeError('immutable quiz snapshot is incomplete');
  }
  if (!Array.isArray(attempt.answers) || attempt.answers.length !== questions.length) {
    throw new TypeError('answer count does not match snapshot');
  }
  if (!attempt.quiz) throw new TypeError('quiz identity is missing');

  const answers = questions.map((question, index) => {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new TypeError('question options are invalid');
    }
    return selectedAnswer(question, attempt.answers[index]);
  });
  const correctAnswers = questions.reduce(
    (total, question, index) => total + (isCorrectAnswer(question, answers[index]) ? 1 : 0),
    0,
  );
  const totalQuestions = questions.length;
  const score = Math.round((correctAnswers / totalQuestions) * 100);
  const idempotencyKey =
    typeof attempt.idempotencyKey === 'string' && attempt.idempotencyKey.length >= 16
      ? attempt.idempotencyKey
      : `migration:${attempt._id}`;
  const submissionDigest = createHash('sha256')
    .update(JSON.stringify({ quizId: String(attempt.quiz), answers }))
    .digest('hex');

  return { idempotencyKey, submissionDigest, correctAnswers, totalQuestions, score };
}

function sameCanonicalFields(attempt, fields) {
  return Object.entries(fields).every(([key, value]) => attempt[key] === value);
}

export function createPlanSha(plan) {
  const canonical = {
    deleteIds: plan.deleteIds.map(String).sort(),
    updates: plan.updates
      .map(({ id, fields }) => ({ id: String(id), fields }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export async function inspectAttemptSubmissionContract(db) {
  const attempts = await db
    .collection('attempts')
    .find(
      {},
      {
        projection: {
          _id: 1,
          user: 1,
          guestEmail: 1,
          quiz: 1,
          quizSnapshot: 1,
          answers: 1,
          idempotencyKey: 1,
          submissionDigest: 1,
          correctAnswers: 1,
          totalQuestions: 1,
          score: 1,
        },
      },
    )
    .toArray();
  const updates = [];
  const deleteIds = [];
  const deleteReasons = {};

  for (const attempt of attempts) {
    try {
      const hasUser = attempt.user != null;
      const hasGuest = typeof attempt.guestEmail === 'string' && attempt.guestEmail.length > 0;
      if (hasUser === hasGuest) throw new TypeError('identity is not exclusive');

      const fields = canonicalFields(attempt);
      if (!sameCanonicalFields(attempt, fields)) updates.push({ id: attempt._id, fields });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown validation error';
      deleteIds.push(attempt._id);
      deleteReasons[reason] = (deleteReasons[reason] ?? 0) + 1;
    }
  }

  const plan = { scanned: attempts.length, updates, deleteIds, deleteReasons };
  return { ...plan, planSha: createPlanSha(plan) };
}

export function validateApplyOptions({ apply, approvedPlanSha, maxDelete, plan }) {
  if (!apply) return;
  if (!approvedPlanSha || approvedPlanSha !== plan.planSha) {
    throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
  }
  if (!Number.isSafeInteger(maxDelete) || maxDelete < 0) {
    throw new Error('--max-delete must be a non-negative safe integer');
  }
  if (plan.deleteIds.length > maxDelete) {
    throw new Error(
      `Plan deletes ${plan.deleteIds.length} attempts, above --max-delete=${maxDelete}`,
    );
  }
}

async function applyPlan(db, client, plan) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      if (plan.updates.length > 0) {
        const result = await db.collection('attempts').bulkWrite(
          plan.updates.map(({ id, fields }) => ({
            updateOne: {
              filter: { _id: id },
              update: { $set: fields },
            },
          })),
          { ordered: true, session, comment: MIGRATION_COMMENT },
        );
        if (result.matchedCount !== plan.updates.length) {
          throw new Error(
            `Matched ${result.matchedCount} attempts but plan expected ${plan.updates.length}`,
          );
        }
      }
      if (plan.deleteIds.length > 0) {
        const result = await db
          .collection('attempts')
          .deleteMany({ _id: { $in: plan.deleteIds } }, { session, comment: MIGRATION_COMMENT });
        if (result.deletedCount !== plan.deleteIds.length) {
          throw new Error(
            `Deleted ${result.deletedCount} attempts but plan expected ${plan.deleteIds.length}`,
          );
        }
      }
    });
  } finally {
    await session.endSession();
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const apply = process.argv.includes('--apply');
  const approvedPlanSha = readOption('approve-plan');
  const maxDelete = Number(readOption('max-delete') ?? DEFAULT_MAX_DELETE);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

  try {
    await client.connect();
    const db = client.db();
    const plan = await inspectAttemptSubmissionContract(db);
    validateApplyOptions({ apply, approvedPlanSha, maxDelete, plan });

    if (apply && (plan.updates.length > 0 || plan.deleteIds.length > 0)) {
      await applyPlan(db, client, plan);
    }
    const verification = apply ? await inspectAttemptSubmissionContract(db) : null;
    if (verification && (verification.updates.length > 0 || verification.deleteIds.length > 0)) {
      throw new Error('Post-apply verification found remaining non-canonical attempts');
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          databaseName: db.databaseName,
          scanned: plan.scanned,
          updates: plan.updates.length,
          deletes: plan.deleteIds.length,
          deleteReasons: plan.deleteReasons,
          planSha: plan.planSha,
          verified: verification
            ? verification.updates.length === 0 && verification.deleteIds.length === 0
            : undefined,
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
