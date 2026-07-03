import type { QuizQuestionInputViewModel } from '@/features/quiz/types/quiz-question';
import type { components } from '@/generated/adaptive-api';

type QuizDraftTransportContract = components['schemas']['QuizDraftResponseData'];

export interface QuizDraftPdf {
  s3Key: QuizDraftTransportContract['pdf']['s3_key'];
  fileName: QuizDraftTransportContract['pdf']['file_name'];
  fileSize: QuizDraftTransportContract['pdf']['file_size'];
  pageCount: QuizDraftTransportContract['pdf']['page_count'];
}

export interface QuizDraftProgress {
  processed: QuizDraftTransportContract['progress']['processed'];
  total: QuizDraftTransportContract['progress']['total'];
  percent: QuizDraftTransportContract['progress']['percent'];
}

export interface QuizDraft {
  id: QuizDraftTransportContract['draft_id'];
  title: QuizDraftTransportContract['title'];
  description: QuizDraftTransportContract['description'];
  folderId: QuizDraftTransportContract['category_id'];
  prompt: QuizDraftTransportContract['prompt'];
  pdf: QuizDraftPdf;
  status: QuizDraftTransportContract['status'];
  progress: QuizDraftProgress;
  questions: QuizQuestionInputViewModel[];
  error: QuizDraftTransportContract['error'];
  submittedQuizId: QuizDraftTransportContract['submitted_quiz_id'];
  createdAt: QuizDraftTransportContract['created_at'];
  updatedAt: QuizDraftTransportContract['updated_at'];
  expiresAt: QuizDraftTransportContract['expires_at'];
}
