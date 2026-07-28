import type { ReportStatus } from '@/shared/constants/report-status';
import type { QuizQuestionWithAnswerKey } from '@/shared/types/quiz-question';

export interface ReportQuestionSnapshot extends QuizQuestionWithAnswerKey {
  index: number;
}

export interface ReportCoreFields {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  questionId?: string;
  questionSnapshot?: ReportQuestionSnapshot;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: ReportStatus;
}

export interface ReportFields extends ReportCoreFields {
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}
