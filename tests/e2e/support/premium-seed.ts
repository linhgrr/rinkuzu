import { createHash } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';

/**
 * Seed for a fake approved Premium quiz, shared by the Premium E2E specs (RIN-747, RIN-1758).
 * Writes only to the local `rinkuzu_ci` database; every other host or name is refused.
 */

export function requireCiMongoUri(): { databaseName: string; uri: string } {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is required for Premium E2E');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '');
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    databaseName !== 'rinkuzu_ci'
  ) {
    throw new Error('Premium E2E seed/cleanup is allowed only for mongodb://localhost/rinkuzu_ci');
  }
  return { databaseName, uri };
}

interface PremiumSeedOptions {
  runId: string;
  slug: string;
  title: string;
  description: string;
  questionCount: number;
}

export interface PremiumSeed {
  submissionId: ObjectId;
  /** The id the player and the unlock API use for the quiz. */
  quizId: ObjectId;
}

/** Every question is single-choice with "Right" (index 0) and "Wrong". */
export async function seedPremiumSubmission(
  db: Db,
  { runId, slug, title, description, questionCount }: PremiumSeedOptions,
): Promise<PremiumSeed> {
  const now = new Date();
  const submissionId = new ObjectId();
  const quizId = new ObjectId();
  await db.collection('premiumquizsubmissions').insertOne({
    _id: submissionId,
    _e2eRun: runId,
    sourceQuiz: quizId,
    author: new ObjectId(),
    version: 1,
    status: 'approved',
    sourceType: 'manual',
    rightsAttested: true,
    snapshot: {
      title,
      slug,
      description,
      questions: Array.from({ length: questionCount }, (_, index) => ({
        _id: new ObjectId(),
        correctIndex: 0,
        options: ['Right', 'Wrong'],
        question: `Premium question ${index + 1}?`,
        type: 'single',
      })),
    },
    // Play sessions store this as a 64-character hex digest.
    snapshotHash: createHash('sha256').update(`e2e-${runId}`).digest('hex'),
    questionHashes: [],
    duplicateReport: {
      exactDocumentRewarded: false,
      exactQuiz: false,
      sharedQuestionCount: 0,
      highestSimilarity: 0,
      matches: [],
    },
    reviewStatus: 'completed',
    awardedCredits: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  return { submissionId, quizId };
}
