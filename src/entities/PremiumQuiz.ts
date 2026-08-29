import type { QuizQuestion } from '@/entities/Quiz';

export const PREMIUM_SUBMISSION_STATUSES = [
  'pending',
  'changes_requested',
  'rejected',
  'approved',
] as const;

type PremiumSubmissionStatus = (typeof PREMIUM_SUBMISSION_STATUSES)[number];
export type PremiumSourceType = 'pdf' | 'manual';
export type PremiumReviewStatus = 'not_started' | 'queued' | 'running' | 'completed' | 'failed';
type PremiumReviewVerdict = 'pass' | 'needs_review' | 'fail';

export interface PremiumQuizSnapshot {
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestion[];
}

export interface PremiumDuplicateMatch {
  submissionId: string;
  quizId: string;
  title: string;
  similarity: number;
  reason: 'exact_quiz' | 'shared_questions' | 'fuzzy';
}

export interface PremiumDuplicateReport {
  exactDocumentRewarded: boolean;
  exactQuiz: boolean;
  sharedQuestionCount: number;
  highestSimilarity: number;
  matches: PremiumDuplicateMatch[];
}

interface PremiumReviewCriterion {
  key: string;
  score: number;
  note: string;
}

interface PremiumReviewIssue {
  questionIndex?: number;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface PremiumReviewResult {
  verdict: PremiumReviewVerdict;
  score: number;
  suggestedCredits: number;
  groundingAvailable: boolean;
  summary: string;
  criteria: PremiumReviewCriterion[];
  issues: PremiumReviewIssue[];
}

export interface PremiumQuizSubmission {
  id: string;
  sourceQuizId: string;
  authorId: string;
  version: number;
  status: PremiumSubmissionStatus;
  sourceType: PremiumSourceType;
  rightsAttested: boolean;
  snapshot: PremiumQuizSnapshot;
  snapshotHash: string;
  questionHashes: string[];
  documentFingerprint?: string;
  sourceObjectKey?: string;
  duplicateReport: PremiumDuplicateReport;
  reviewStatus: PremiumReviewStatus;
  reviewJobId?: string;
  reviewSnapshotHash?: string;
  reviewResult?: PremiumReviewResult;
  reviewError?: string;
  reviewerId?: string;
  reviewerNote?: string;
  overrideReason?: string;
  awardedCredits: number;
  active: boolean;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditWallet {
  userId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

type CreditLedgerType =
  | 'submission_reward'
  | 'quiz_unlock'
  | 'refund'
  | 'admin_adjustment'
  | 'fraud_reversal';

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  type: CreditLedgerType;
  referenceType: 'premium_submission' | 'premium_quiz' | 'admin';
  referenceId: string;
  idempotencyKey: string;
  note?: string;
  createdAt: Date;
}

export type PremiumAnswer = number | number[];

export interface PremiumAccessContext {
  userId: string;
  role?: string;
}

export type PremiumAccessDecision = boolean;

export interface PremiumSourceUrl {
  url: string;
  expiresIn: number;
}

export interface PremiumPlaySession {
  id: string;
  userId: string;
  quizId: string;
  submissionId: string;
  snapshotHash: string;
  answers: PremiumAnswer[];
  currentQuestionIndex: number;
  highestBatch: number;
  sessionCode: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
