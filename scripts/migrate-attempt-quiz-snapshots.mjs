import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';
import { MongoClient, ObjectId } from 'mongodb';

const { loadEnvConfig } = nextEnv;
const DEFAULT_MAX_DOCUMENTS = 1_000;
const MIGRATION_COMMENT = 'migrate-attempt-quiz-snapshots-v1';

export function buildAttemptQuizSnapshotPlan({ attemptRows, quizRows }) {
  const quizzesById = new Map();
  for (const quiz of quizRows) {
    const id = requireObjectId(quiz?._id, 'quiz._id');
    const key = id.toHexString();
    if (quizzesById.has(key)) throw new Error(`Duplicate quiz row ${key}`);
    quizzesById.set(key, quiz);
  }

  const updateActions = [];
  const deleteActions = [];

  for (const attempt of attemptRows) {
    const id = requireObjectId(attempt?._id, 'attempt._id');
    const guard = buildAttemptGuard(attempt);

    try {
      const takenAt = requireDate(attempt.takenAt);
      const hasSnapshot = Object.hasOwn(attempt, 'quizSnapshot');
      const source = hasSnapshot
        ? attempt.quizSnapshot
        : quizzesById.get(requireRecoverableObjectId(attempt.quiz, 'missingQuiz').toHexString());

      if (!source) throw new UnrecoverableAttemptError('missingQuiz');
      const snapshot = normalizeSnapshot(source, {
        enforceQuestionAge: !hasSnapshot,
        takenAt,
      });
      const answers = normalizeAnswers(attempt.answers, snapshot.questions);
      const totalQuestions = snapshot.questions.length;
      const score = calculateScore(answers, snapshot.questions);
      const alreadyCanonical =
        hasSnapshot &&
        canonicalEquals(attempt.quizSnapshot, snapshot) &&
        canonicalEquals(attempt.answers, answers) &&
        attempt.totalQuestions === totalQuestions &&
        attempt.score === score;

      if (!alreadyCanonical) {
        updateActions.push({
          id,
          guard,
          set: { quizSnapshot: snapshot, answers, totalQuestions, score },
          normalizedScore: attempt.score !== score,
          normalizedTotalQuestions: attempt.totalQuestions !== totalQuestions,
        });
      }
    } catch (error) {
      if (!(error instanceof UnrecoverableAttemptError)) throw error;
      deleteActions.push({ id, guard, reason: error.reason });
    }
  }

  updateActions.sort(compareActions);
  deleteActions.sort(compareActions);

  const deletionReasons = Object.fromEntries(
    [...new Set(deleteActions.map(({ reason }) => reason))]
      .sort()
      .map((reason) => [reason, deleteActions.filter((action) => action.reason === reason).length]),
  );
  const summary = {
    snapshotsToCreateOrNormalize: updateActions.length,
    attemptsToDelete: deleteActions.length,
    totalDocuments: updateActions.length + deleteActions.length,
    normalizedScores: updateActions.filter(({ normalizedScore }) => normalizedScore).length,
    normalizedTotalQuestions: updateActions.filter(
      ({ normalizedTotalQuestions }) => normalizedTotalQuestions,
    ).length,
    deletionReasons,
  };
  const planSha = createHash('sha256')
    .update(
      JSON.stringify(
        canonicalize({
          updates: updateActions.map(({ id: actionId, set }) => ({
            id: actionId.toHexString(),
            set,
          })),
          deletes: deleteActions.map(({ id: actionId, reason }) => ({
            id: actionId.toHexString(),
            reason,
          })),
        }),
      ),
    )
    .digest('hex');

  return { updateActions, deleteActions, summary, planSha };
}

export function validateAttemptQuizSnapshotMigration({
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
      `Migration plan contains ${plan.summary.totalDocuments} documents, above the --max-documents limit of ${maxDocuments}`,
    );
  }
  if (!approvedPlanSha) throw new Error(`Apply requires --approve-plan=${plan.planSha}`);
  if (approvedPlanSha !== plan.planSha) {
    throw new Error('Approved plan SHA does not match the current migration plan');
  }
}

export async function inspectAttemptQuizSnapshotMigration(db) {
  const collections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );
  if (!collections.has('attempts') || !collections.has('quizzes')) {
    throw new Error('Both attempts and quizzes collections are required');
  }

  const [attemptRows, quizRows] = await Promise.all([
    db
      .collection('attempts')
      .find(
        {},
        {
          projection: {
            quiz: 1,
            quizSnapshot: 1,
            answers: 1,
            score: 1,
            totalQuestions: 1,
            takenAt: 1,
          },
        },
      )
      .toArray(),
    db
      .collection('quizzes')
      .find({}, { projection: { title: 1, slug: 1, description: 1, questions: 1 } })
      .toArray(),
  ]);

  return buildAttemptQuizSnapshotPlan({ attemptRows, quizRows });
}

export async function applyAttemptQuizSnapshotMigration(db, plan, session) {
  const attempts = db.collection('attempts');
  const updateOperations = plan.updateActions.map(({ guard, set }) => ({
    updateOne: { filter: guard, update: { $set: set } },
  }));
  const deleteOperations = plan.deleteActions.map(({ guard }) => ({
    deleteOne: { filter: guard },
  }));

  const updateResult =
    updateOperations.length === 0
      ? { matchedCount: 0, modifiedCount: 0 }
      : await attempts.bulkWrite(updateOperations, {
          ordered: true,
          comment: MIGRATION_COMMENT,
          session,
        });
  if (
    updateResult.matchedCount !== updateOperations.length ||
    updateResult.modifiedCount !== updateOperations.length
  ) {
    throw new Error(
      `Updated ${updateResult.modifiedCount}/${updateOperations.length} attempts after matching ${updateResult.matchedCount}; source data changed after plan approval`,
    );
  }

  const deleteResult =
    deleteOperations.length === 0
      ? { deletedCount: 0 }
      : await attempts.bulkWrite(deleteOperations, {
          ordered: true,
          comment: MIGRATION_COMMENT,
          session,
        });
  if (deleteResult.deletedCount !== deleteOperations.length) {
    throw new Error(
      `Deleted ${deleteResult.deletedCount}/${deleteOperations.length} attempts; source data changed after plan approval`,
    );
  }

  return {
    snapshotsCreatedOrNormalized: updateResult.modifiedCount,
    attemptsDeleted: deleteResult.deletedCount,
  };
}

class UnrecoverableAttemptError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function normalizeSnapshot(source, { enforceQuestionAge, takenAt }) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new UnrecoverableAttemptError('malformedQuizSnapshot');
  }
  if (Object.hasOwn(source, 'integrity') && source.integrity !== 'complete') {
    throw new UnrecoverableAttemptError('incompleteQuizSnapshot');
  }
  if (typeof source.title !== 'string' || source.title.trim().length === 0) {
    throw new UnrecoverableAttemptError('malformedQuizMetadata');
  }
  if (typeof source.slug !== 'string' || source.slug.trim().length === 0) {
    throw new UnrecoverableAttemptError('malformedQuizMetadata');
  }
  if (!Array.isArray(source.questions) || source.questions.length === 0) {
    throw new UnrecoverableAttemptError('missingQuizQuestions');
  }

  const questions = source.questions.map((question) =>
    normalizeQuestion(question, {
      enforceQuestionAge,
      takenAt,
    }),
  );
  return {
    integrity: 'complete',
    title: source.title.trim(),
    slug: source.slug.trim().toLowerCase(),
    ...(typeof source.description === 'string' && source.description.trim().length > 0
      ? { description: source.description.trim() }
      : {}),
    questions,
  };
}

function normalizeQuestion(question, { enforceQuestionAge, takenAt }) {
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    throw new UnrecoverableAttemptError('invalidQuizQuestionObject');
  }
  const id = requireRecoverableObjectId(question._id, 'invalidQuizQuestionId');
  if (enforceQuestionAge && id.getTimestamp().getTime() > takenAt.getTime()) {
    throw new UnrecoverableAttemptError('quizQuestionsChangedAfterAttempt');
  }
  if (typeof question.question !== 'string' || question.question.trim().length === 0) {
    throw new UnrecoverableAttemptError('invalidQuizQuestionText');
  }
  if (
    !Array.isArray(question.options) ||
    question.options.length < 2 ||
    question.options.length > 20 ||
    question.options.some((option) => typeof option !== 'string')
  ) {
    throw new UnrecoverableAttemptError('invalidQuizQuestionOptions');
  }

  const options = question.options.map((option) => option.trim());
  const optionImages =
    Array.isArray(question.optionImages) && question.optionImages.length > 0
      ? normalizeOptionImages(question.optionImages, options.length)
      : undefined;
  if (
    options.some(
      (option, index) =>
        option.length === 0 &&
        !(typeof optionImages?.[index] === 'string' && optionImages[index].length > 0),
    )
  ) {
    throw new UnrecoverableAttemptError('invalidQuizQuestionOptions');
  }
  const base = {
    _id: id,
    question: question.question.trim(),
    options,
    ...(typeof question.questionImage === 'string' && question.questionImage.trim().length > 0
      ? { questionImage: question.questionImage.trim() }
      : {}),
    ...(optionImages === undefined ? {} : { optionImages }),
  };

  if (question.type === 'single') {
    if (!isOptionIndex(question.correctIndex, options.length)) {
      throw new UnrecoverableAttemptError('invalidQuizCorrectAnswer');
    }
    return { ...base, type: 'single', correctIndex: question.correctIndex };
  }
  if (question.type === 'multiple') {
    if (!isValidIndexList(question.correctIndexes, options.length, false)) {
      throw new UnrecoverableAttemptError('invalidQuizCorrectAnswer');
    }
    return { ...base, type: 'multiple', correctIndexes: [...question.correctIndexes] };
  }
  throw new UnrecoverableAttemptError('invalidQuizQuestionType');
}

function normalizeOptionImages(optionImages, optionCount) {
  if (
    optionImages.length !== optionCount ||
    optionImages.some((image) => image != null && typeof image !== 'string')
  ) {
    throw new UnrecoverableAttemptError('invalidQuizOptionImages');
  }
  return optionImages.map((image) => (typeof image === 'string' ? image.trim() : image));
}

function normalizeAnswers(rawAnswers, questions) {
  if (!Array.isArray(rawAnswers) || rawAnswers.length !== questions.length) {
    throw new UnrecoverableAttemptError('answerQuestionCountMismatch');
  }
  return rawAnswers.map((answer, index) => {
    const question = questions[index];
    if (question.type === 'single') {
      if (
        !answer ||
        typeof answer !== 'object' ||
        Array.isArray(answer) ||
        answer.kind !== 'single'
      ) {
        throw new UnrecoverableAttemptError('malformedAnswers');
      }
      if (answer.selectedIndex === null) {
        return { kind: 'single', selectedIndex: null };
      }
      if (!isOptionIndex(answer.selectedIndex, question.options.length)) {
        throw new UnrecoverableAttemptError('malformedAnswers');
      }
      return { kind: 'single', selectedIndex: answer.selectedIndex };
    }

    if (
      !answer ||
      typeof answer !== 'object' ||
      Array.isArray(answer) ||
      answer.kind !== 'multiple' ||
      !isValidIndexList(answer.selectedIndexes, question.options.length, true)
    ) {
      throw new UnrecoverableAttemptError('malformedAnswers');
    }
    return { kind: 'multiple', selectedIndexes: [...answer.selectedIndexes] };
  });
}

function calculateScore(answers, questions) {
  const correct = questions.reduce((count, question, index) => {
    const answer = answers[index];
    if (question.type === 'single') {
      return count + (answer.selectedIndex === question.correctIndex ? 1 : 0);
    }
    const expected = [...question.correctIndexes].sort((a, b) => a - b);
    return count + (canonicalEquals(answer.selectedIndexes, expected) ? 1 : 0);
  }, 0);
  return Math.round((correct / questions.length) * 100);
}

function buildAttemptGuard(attempt) {
  const guard = {
    _id: attempt._id,
    quiz: attempt.quiz,
    answers: attempt.answers,
    score: Object.hasOwn(attempt, 'score') ? attempt.score : { $exists: false },
    totalQuestions: Object.hasOwn(attempt, 'totalQuestions')
      ? attempt.totalQuestions
      : { $exists: false },
    takenAt: attempt.takenAt,
    quizSnapshot: Object.hasOwn(attempt, 'quizSnapshot')
      ? attempt.quizSnapshot
      : { $exists: false },
  };
  return guard;
}

function isOptionIndex(value, optionCount) {
  return Number.isInteger(value) && value >= 0 && value < optionCount;
}

function isValidIndexList(value, optionCount, allowEmpty) {
  return (
    Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every((index) => isOptionIndex(index, optionCount)) &&
    new Set(value).size === value.length
  );
}

function requireObjectId(value, fieldName) {
  if (!ObjectId.isValid(value)) throw new TypeError(`${fieldName} must be an ObjectId`);
  return value instanceof ObjectId ? value : new ObjectId(value);
}

function requireRecoverableObjectId(value, reason) {
  try {
    return requireObjectId(value, 'question._id');
  } catch {
    throw new UnrecoverableAttemptError(reason);
  }
}

function requireDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new UnrecoverableAttemptError('invalidAttemptTimestamp');
  }
  return date;
}

function compareActions(left, right) {
  return left.id.toHexString().localeCompare(right.id.toHexString());
}

function canonicalEquals(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value) {
  if (value instanceof ObjectId) return value.toHexString();
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
    const plan = await inspectAttemptQuizSnapshotMigration(db);
    validateAttemptQuizSnapshotMigration({
      apply,
      approvedPlanSha,
      maxDocuments,
      plan,
    });

    let execution = {
      snapshotsCreatedOrNormalized: 0,
      attemptsDeleted: 0,
      verified: undefined,
    };
    if (apply && plan.summary.totalDocuments > 0) {
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          execution = {
            ...(await applyAttemptQuizSnapshotMigration(db, plan, session)),
            verified: false,
          };
        });
      } finally {
        await session.endSession();
      }

      const verification = await inspectAttemptQuizSnapshotMigration(db);
      if (verification.summary.totalDocuments !== 0) {
        throw new Error(
          `Post-apply verification found ${verification.summary.totalDocuments} attempts still requiring migration`,
        );
      }
      execution.verified = true;
    }

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
if (import.meta.url === entryPath) await main();
