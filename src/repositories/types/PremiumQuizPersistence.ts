import type { PREMIUM_SUBMISSION_STATUSES } from '@/entities/PremiumQuiz';
import type { PremiumPlaySessionFields } from '@/models/PremiumPlaySession';
import type { MongoIdLike } from '@/types/mongo';
import type { QuizQuestionPersistenceRecord } from '@/repositories/types/QuizPersistence';

// The submission snapshot below deliberately echoes its sibling in
// src/models/PremiumQuizSubmission.ts; see docs/architecture/three-layer-standard.md.
// The play-session record at the bottom of this file does NOT: it shares its
// field list with the schema, because both sit inside the persistence layer.
interface PremiumSnapshotPersistenceRecord {
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestionPersistenceRecord[];
}

interface PremiumDuplicateMatchPersistenceRecord {
  submissionId: MongoIdLike;
  quizId: MongoIdLike;
  title: string;
  similarity: number;
  reason: 'exact_quiz' | 'shared_questions' | 'fuzzy';
}

interface PremiumDuplicateReportPersistenceRecord {
  exactDocumentRewarded: boolean;
  exactQuiz: boolean;
  sharedQuestionCount: number;
  highestSimilarity: number;
  matches: PremiumDuplicateMatchPersistenceRecord[];
}

interface PremiumReviewCriterionPersistenceRecord {
  key: string;
  score: number;
  note: string;
}

interface PremiumReviewIssuePersistenceRecord {
  questionIndex?: number;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

interface PremiumReviewResultPersistenceRecord {
  verdict: 'pass' | 'needs_review' | 'fail';
  score: number;
  suggestedCredits: number;
  groundingAvailable: boolean;
  summary: string;
  criteria: PremiumReviewCriterionPersistenceRecord[];
  issues: PremiumReviewIssuePersistenceRecord[];
}

export interface PremiumQuizSubmissionPersistenceRecord {
  _id: MongoIdLike;
  sourceQuiz: MongoIdLike;
  author: MongoIdLike;
  version: number;
  status: (typeof PREMIUM_SUBMISSION_STATUSES)[number];
  sourceType: 'pdf' | 'manual';
  rightsAttested: boolean;
  snapshot: PremiumSnapshotPersistenceRecord;
  snapshotHash: string;
  questionHashes: string[];
  documentFingerprint?: string;
  sourceObjectKey?: string;
  duplicateReport: PremiumDuplicateReportPersistenceRecord;
  reviewStatus: 'not_started' | 'queued' | 'running' | 'completed' | 'failed';
  reviewJobId?: string;
  reviewSnapshotHash?: string;
  reviewResult?: PremiumReviewResultPersistenceRecord;
  reviewError?: string;
  reviewer?: MongoIdLike;
  reviewerNote?: string;
  overrideReason?: string;
  awardedCredits: number;
  active: boolean;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditWalletPersistenceRecord {
  _id: MongoIdLike;
  user: MongoIdLike;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditLedgerPersistenceRecord {
  _id: MongoIdLike;
  user: MongoIdLike;
  amount: number;
  balanceAfter: number;
  type: 'submission_reward' | 'quiz_unlock' | 'refund' | 'admin_adjustment' | 'fraud_reversal';
  referenceType: 'premium_submission' | 'premium_quiz' | 'admin';
  referenceId: string;
  idempotencyKey: string;
  note?: string;
  createdAt: Date;
}

export interface PremiumPlaySessionPersistenceRecord extends PremiumPlaySessionFields<MongoIdLike> {
  _id: MongoIdLike;
}
