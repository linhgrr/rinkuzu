// Client for the FastAPI-owned quiz draft lifecycle, reached through the
// same-origin Next proxy at /api/quiz-drafts/* (which injects the internal
// service token server-side). The FastAPI contract uses snake_case fields.
import { fetchApiData } from '@/lib/api/client';
import type { IQuestion } from '@/models/Quiz';

export type QuizDraftStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'submitted'
  | 'expired';

// Store-side status vocabulary used by the draft UI (progress badge, polling).
export type StoreDraftStatus = 'processing' | 'completed' | 'error';

// Collapse the FastAPI draft status set onto the store vocabulary. `submitted`
// maps to null: the draft is already published, so the UI drops it from sync.
export function mapDraftStatus(status: QuizDraftStatus): StoreDraftStatus | null {
  switch (status) {
    case 'queued':
    case 'processing':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'cancelled':
    case 'expired':
      return 'error';
    case 'submitted':
      return null;
  }
}

export interface QuizDraftPdf {
  s3_key: string | null;
  file_name: string | null;
  file_size: number | null;
  page_count: number | null;
}

export interface QuizDraftProgress {
  processed: number;
  total: number;
  percent: number;
}

export interface QuizDraft {
  draft_id: string;
  title: string;
  description: string;
  category_id: string | null;
  prompt: string | null;
  pdf: QuizDraftPdf;
  status: QuizDraftStatus;
  progress: QuizDraftProgress;
  questions: IQuestion[];
  error: string | null;
  submitted_quiz_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface CreateQuizDraftInput {
  title: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  categoryId?: string;
  description?: string;
  prompt?: string;
}

export async function createQuizDraft(input: CreateQuizDraftInput): Promise<QuizDraft> {
  const { draft } = await fetchApiData<{ draft: QuizDraft }>('/api/quiz-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      s3_key: input.s3Key,
      file_name: input.fileName,
      file_size: input.fileSize,
      category_id: input.categoryId,
      description: input.description,
      prompt: input.prompt,
    }),
  });
  return draft;
}

export async function getQuizDraft(
  draftId: string,
  init?: { signal?: AbortSignal },
): Promise<QuizDraft> {
  const { draft } = await fetchApiData<{ draft: QuizDraft }>(`/api/quiz-drafts/${draftId}`, init);
  return draft;
}

export async function listQuizDrafts(init?: { signal?: AbortSignal }): Promise<QuizDraft[]> {
  const { drafts } = await fetchApiData<{ drafts: QuizDraft[] }>('/api/quiz-drafts', init);
  return drafts;
}

export interface PatchQuizDraftInput {
  title?: string;
  description?: string;
  categoryId?: string;
  questions?: IQuestion[];
}

export async function patchQuizDraft(
  draftId: string,
  input: PatchQuizDraftInput,
): Promise<QuizDraft> {
  const { draft } = await fetchApiData<{ draft: QuizDraft }>(`/api/quiz-drafts/${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      questions: input.questions,
    }),
  });
  return draft;
}

export async function deleteQuizDraft(draftId: string): Promise<void> {
  await fetchApiData(`/api/quiz-drafts/${draftId}`, { method: 'DELETE' });
}

export interface SubmitQuizDraftInput {
  title: string;
  categoryId: string;
  description?: string;
  questions: IQuestion[];
  isPrivate?: boolean;
}

export interface SubmitQuizDraftResult {
  quizId: string;
  slug: string;
  warnings: string[];
}

export async function submitQuizDraft(
  draftId: string,
  input: SubmitQuizDraftInput,
): Promise<SubmitQuizDraftResult> {
  return fetchApiData<SubmitQuizDraftResult>(`/api/quiz-drafts/${draftId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
