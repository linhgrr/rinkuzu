import type { QuizQuestionInputViewModel } from '@/features/quiz/types/quiz-question';
import type { QuizDraftStatus } from '@/lib/quiz/draftStatus';

export interface QuizDraftPdf {
  s3Key: string | null;
  fileName: string | null;
  fileSize: number | null;
  pageCount: number | null;
}

export interface QuizDraftProgress {
  processed: number;
  total: number;
  percent: number;
}

export interface QuizDraft {
  id: string;
  title: string;
  description: string;
  folderId: string | null;
  prompt: string | null;
  pdf: QuizDraftPdf;
  status: QuizDraftStatus;
  progress: QuizDraftProgress;
  questions: QuizQuestionInputViewModel[];
  error: string | null;
  submittedQuizId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
