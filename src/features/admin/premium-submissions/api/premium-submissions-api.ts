import { fetchApiData } from '@/lib/api/client';

export type PremiumSubmissionStatusViewModel =
  | 'pending'
  | 'changes_requested'
  | 'rejected'
  | 'approved'
  | 'withdrawn';

interface PremiumQuestionViewModel {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
}

interface PremiumSnapshotViewModel {
  title: string;
  slug: string;
  description?: string;
  questions: PremiumQuestionViewModel[];
}

interface PremiumDuplicateMatchViewModel {
  submissionId: string;
  title: string;
  similarity: number;
  reason: string;
}

interface PremiumDuplicateReportViewModel {
  exactDocumentRewarded: boolean;
  exactQuiz: boolean;
  sharedQuestionCount: number;
  highestSimilarity: number;
  matches: PremiumDuplicateMatchViewModel[];
}

interface PremiumReviewCriterionViewModel {
  key: string;
  score: number;
  note: string;
}

interface PremiumReviewIssueViewModel {
  questionIndex?: number;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

interface PremiumReviewResultViewModel {
  verdict: 'pass' | 'needs_review' | 'fail';
  score: number;
  suggestedCredits: number;
  groundingAvailable: boolean;
  summary: string;
  criteria: PremiumReviewCriterionViewModel[];
  issues: PremiumReviewIssueViewModel[];
}

export interface PremiumSubmissionViewModel {
  id: string;
  sourceQuizId: string;
  authorId: string;
  version: number;
  status: PremiumSubmissionStatusViewModel;
  sourceType: 'pdf' | 'manual';
  snapshot: PremiumSnapshotViewModel;
  snapshotHash: string;
  duplicateReport: PremiumDuplicateReportViewModel;
  reviewStatus: 'not_started' | 'queued' | 'running' | 'completed' | 'failed';
  reviewResult?: PremiumReviewResultViewModel;
  reviewError?: string;
  awardedCredits: number;
  active: boolean;
  createdAt: string;
}

export interface PremiumSubmissionListViewModel {
  items: PremiumSubmissionViewModel[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PremiumDecisionInput {
  decision: 'approve' | 'request_changes' | 'reject';
  credits: number;
  note?: string;
  overrideReason?: string;
}

export interface PremiumDecisionResultViewModel {
  submission: PremiumSubmissionViewModel;
  awardedCredits: number;
  rewardLocked: boolean;
}

export interface PremiumSourceUrlViewModel {
  url: string;
  expiresIn: number;
}

export function fetchPremiumSubmissions(
  status: '' | PremiumSubmissionStatusViewModel,
): Promise<PremiumSubmissionListViewModel> {
  const params = new URLSearchParams({ page: '1', limit: '100' });
  if (status) params.set('status', status);
  return fetchApiData<PremiumSubmissionListViewModel>(`/api/admin/premium-submissions?${params}`);
}

export function startPremiumReview(id: string): Promise<PremiumSubmissionViewModel> {
  return fetchApiData<PremiumSubmissionViewModel>(
    `/api/admin/premium-submissions/${id}/llm-review`,
    { method: 'POST' },
  );
}

export function fetchPremiumSourceUrl(id: string): Promise<PremiumSourceUrlViewModel> {
  return fetchApiData<PremiumSourceUrlViewModel>(`/api/admin/premium-submissions/${id}/source`);
}

export function decidePremiumSubmission(
  id: string,
  input: PremiumDecisionInput,
): Promise<PremiumDecisionResultViewModel> {
  return fetchApiData(`/api/admin/premium-submissions/${id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
