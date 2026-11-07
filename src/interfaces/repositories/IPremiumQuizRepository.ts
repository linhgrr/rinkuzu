import type {
  CreditLedgerEntry,
  CreditWallet,
  PremiumAnswer,
  PremiumDuplicateReport,
  PremiumPlaySession,
  PremiumQuizSubmission,
  PremiumQuizSnapshot,
  PremiumReviewResult,
  PremiumReviewStatus,
  PremiumSourceType,
} from '@/entities/PremiumQuiz';

export interface CreatePremiumSubmissionData {
  sourceQuizId: string;
  authorId: string;
  sourceType: PremiumSourceType;
  rightsAttested: boolean;
  snapshot: PremiumQuizSnapshot;
  snapshotHash: string;
  questionHashes: string[];
  documentFingerprint?: string;
  sourceObjectKey?: string;
  duplicateReport: PremiumDuplicateReport;
}

export interface PremiumSubmissionListOptions {
  status?: PremiumQuizSubmission['status'];
  page: number;
  limit: number;
}

export interface PremiumSubmissionListResult {
  items: PremiumQuizSubmission[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface PremiumCatalogItem {
  quizId: string;
  title: string;
  slug: string;
  description?: string;
  questionCount: number;
  /** Present only for a signed-in learner: true when they unlocked it with credit. */
  unlocked?: boolean;
}

export interface PremiumCatalogListOptions {
  search?: string;
  page: number;
  limit: number;
}

export interface PremiumCatalogListResult {
  items: PremiumCatalogItem[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PremiumDecisionData {
  submissionId: string;
  reviewerId: string;
  decision: 'approve' | 'request_changes' | 'reject';
  credits: number;
  note?: string;
  overrideReason?: string;
}

export interface PremiumDecisionResult {
  submission: PremiumQuizSubmission;
  awardedCredits: number;
  rewardLocked: boolean;
}

export interface PremiumReviewRequestData {
  submissionId: string;
  requestedBy: string;
  snapshotHash: string;
}

export interface PremiumReviewRequestRecord {
  id: string;
  submissionId: string;
  snapshotHash: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
}

export interface UpdatePremiumReviewData {
  submissionId: string;
  snapshotHash: string;
  jobId: string;
  status: Exclude<PremiumReviewStatus, 'not_started'>;
  result?: PremiumReviewResult;
  error?: string;
}

export interface CreditLedgerListResult {
  wallet: CreditWallet;
  entries: CreditLedgerEntry[];
}

export interface PremiumUnlockData {
  userId: string;
  quizId: string;
  idempotencyKey: string;
}

export interface PremiumUnlockResult {
  granted: boolean;
  alreadyGranted: boolean;
  balance: number;
}

export interface AdminCreditGrantData {
  userId: string;
  adminUserId: string;
  amount: number;
  note: string;
  idempotencyKey: string;
}

export interface AdminCreditGrantResult {
  userId: string;
  amount: number;
  balance: number;
  ledgerEntryId: string;
  alreadyApplied: boolean;
}

export interface CreatePremiumSessionData {
  userId: string;
  quizId: string;
  submissionId: string;
  snapshotHash: string;
  now: Date;
}

export interface UpdatePremiumProgressData {
  sessionId: string;
  userId: string;
  questionIndex: number;
  answer: PremiumAnswer;
  now: Date;
}

type PremiumSessionSubmissionClaim = 'claimed' | 'replay' | 'conflict' | 'expired';

export interface IPremiumQuizRepository {
  isVerifiedUser(userId: string): Promise<boolean>;
  createSubmission(data: CreatePremiumSubmissionData): Promise<PremiumQuizSubmission>;
  findSubmissionById(id: string): Promise<PremiumQuizSubmission | null>;
  findDuplicateCandidates(limit: number): Promise<PremiumQuizSubmission[]>;
  listMine(
    userId: string,
    options: PremiumSubmissionListOptions,
  ): Promise<PremiumSubmissionListResult>;
  listAdmin(options: PremiumSubmissionListOptions): Promise<PremiumSubmissionListResult>;
  listCatalog(options: PremiumCatalogListOptions): Promise<PremiumCatalogListResult>;
  decide(data: PremiumDecisionData): Promise<PremiumDecisionResult>;
  beginReview(data: PremiumReviewRequestData): Promise<PremiumReviewRequestRecord>;
  updateReview(data: UpdatePremiumReviewData): Promise<PremiumQuizSubmission>;
  getWalletAndLedger(userId: string, limit: number): Promise<CreditLedgerListResult>;
  grantAdminCredits(data: AdminCreditGrantData): Promise<AdminCreditGrantResult>;
  unlock(data: PremiumUnlockData): Promise<PremiumUnlockResult>;
  hasGrant(userId: string, quizId: string): Promise<boolean>;
  /** The subset of quizIds the learner holds a credit-unlock grant for. */
  findGrantedQuizIds(userId: string, quizIds: readonly string[]): Promise<string[]>;
  findActivePublicationByQuizId(quizId: string): Promise<PremiumQuizSubmission | null>;
  findActivePublicationBySlug(slug: string): Promise<PremiumQuizSubmission | null>;
  createSession(data: CreatePremiumSessionData): Promise<PremiumPlaySession>;
  findSession(sessionId: string, userId: string): Promise<PremiumPlaySession | null>;
  consumeBatchQuota(sessionId: string, userId: string, now: Date): Promise<boolean>;
  updateProgress(data: UpdatePremiumProgressData): Promise<PremiumPlaySession | null>;
  claimSessionSubmission(
    sessionId: string,
    userId: string,
    idempotencyKey: string,
    now: Date,
  ): Promise<PremiumSessionSubmissionClaim>;
  completeSession(sessionId: string, userId: string, now: Date): Promise<PremiumPlaySession | null>;
}
