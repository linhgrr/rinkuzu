import { fetchApiData } from '@/lib/api/client';

interface PremiumBatchQuestionViewModel {
  id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
  optionImages?: Array<string | undefined>;
}

export type PremiumAnswerViewModel = number | number[];

export interface PremiumBatchViewModel {
  sessionId: string;
  quizId: string;
  submissionId: string;
  title: string;
  description?: string;
  totalQuestions: number;
  batchIndex: number;
  startIndex: number;
  questions: PremiumBatchQuestionViewModel[];
  nextCursor?: string;
  previousCursor?: string;
  watermark: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  currentQuestionIndex: number;
  answers: Array<PremiumAnswerViewModel | null>;
}

export interface PremiumSubmitResultViewModel {
  attemptId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  sessionId: string;
}

export interface PremiumProgressSaveViewModel {
  saved: boolean;
  currentQuestionIndex: number;
  idleExpiresAt: string;
}

export interface PremiumUnlockResultViewModel {
  granted: boolean;
  alreadyGranted: boolean;
  balance: number;
}

export interface PremiumCatalogMetadataViewModel {
  quizId: string;
  title: string;
  description?: string;
  questionCount: number;
}

export interface PremiumCatalogItemViewModel extends PremiumCatalogMetadataViewModel {
  slug: string;
}

export interface PremiumCatalogListViewModel {
  items: PremiumCatalogItemViewModel[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PremiumCatalogQueryViewModel {
  search: string;
  page: number;
  limit: number;
}

export interface PremiumFlashcardViewModel {
  sessionId: string;
  quizId: string;
  submissionId: string;
  title: string;
  description?: string;
  totalQuestions: number;
  questionIndex: number;
  question: PremiumBatchQuestionViewModel;
  revealCursor: string;
  nextCursor?: string;
  previousCursor?: string;
  watermark: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export type PremiumFlashcardRevealViewModel =
  | { questionIndex: number; type: 'single'; correctIndex: number }
  | { questionIndex: number; type: 'multiple'; correctIndexes: number[] };

export function fetchPremiumCatalogMetadata(
  slug: string,
): Promise<PremiumCatalogMetadataViewModel> {
  return fetchApiData(`/api/premium-quizzes/by-slug/${encodeURIComponent(slug)}`);
}

export function fetchPremiumCatalog(key: string): Promise<PremiumCatalogListViewModel> {
  return fetchApiData(key);
}

export function buildPremiumCatalogKey({
  search,
  page,
  limit,
}: PremiumCatalogQueryViewModel): string {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  return `/api/premium-quizzes?${params.toString()}`;
}

export function startPremiumFlashcardSession(quizId: string): Promise<PremiumFlashcardViewModel> {
  return fetchApiData(`/api/premium-quizzes/${quizId}/flashcards/session`, { method: 'POST' });
}

export function fetchPremiumFlashcard(
  sessionId: string,
  cursor: string,
): Promise<PremiumFlashcardViewModel> {
  return fetchApiData(`/api/premium-quizzes/sessions/${sessionId}/flashcards/card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cursor }),
  });
}

export function revealPremiumFlashcard(
  sessionId: string,
  cursor: string,
): Promise<PremiumFlashcardRevealViewModel> {
  return fetchApiData(`/api/premium-quizzes/sessions/${sessionId}/flashcards/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cursor }),
  });
}

export function startPremiumSession(quizId: string): Promise<PremiumBatchViewModel> {
  return fetchApiData<PremiumBatchViewModel>(`/api/premium-quizzes/${quizId}/session`, {
    method: 'POST',
  });
}

export function fetchPremiumBatch(
  sessionId: string,
  cursor: string,
): Promise<PremiumBatchViewModel> {
  return fetchApiData<PremiumBatchViewModel>(`/api/premium-quizzes/sessions/${sessionId}/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cursor }),
  });
}

export function savePremiumAnswer(
  sessionId: string,
  questionIndex: number,
  answer: PremiumAnswerViewModel,
): Promise<PremiumProgressSaveViewModel> {
  return fetchApiData(`/api/premium-quizzes/sessions/${sessionId}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIndex, answer }),
  });
}

export function submitPremiumSession(sessionId: string): Promise<PremiumSubmitResultViewModel> {
  return fetchApiData<PremiumSubmitResultViewModel>(
    `/api/premium-quizzes/sessions/${sessionId}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    },
  );
}

export function unlockPremiumQuiz(quizId: string): Promise<PremiumUnlockResultViewModel> {
  return fetchApiData(`/api/premium-quizzes/${quizId}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
  });
}
