import type { MongoIdLike } from '@/types/mongo';
import type { QuizQuestionPersistenceRecord } from '@/repositories/types/QuizPersistence';

// This shape deliberately echoes its sibling in src/models/PremiumPlaySession.ts;
// see docs/architecture/three-layer-standard.md. Do not derive one from another.
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

interface PremiumSessionAnswerPersistenceRecord {
  questionIndex: number;
  selectedIndex?: number;
  selectedIndexes?: number[];
}

export interface PremiumQuizSubmissionPersistenceRecord {
  _id: MongoIdLike;
  sourceQuiz: MongoIdLike;
  author: MongoIdLike;
  version: number;
  status: 'pending' | 'changes_requested' | 'rejected' | 'approved';
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

export interface PremiumPlaySessionPersistenceRecord {
  _id: MongoIdLike;
  user: MongoIdLike;
  quiz: MongoIdLike;
  submission: MongoIdLike;
  snapshotHash: string;
  answers: PremiumSessionAnswerPersistenceRecord[];
  currentQuestionIndex: number;
  highestBatch: number;
  sessionCode: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  purgeAt: Date;
  batchWindowStartedAt: Date;
  batchRequestCount: number;
  submissionIdempotencyKey?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
