import type { ReportStatus } from '@/shared/constants/report-status';
import type { ReportReason, ReportSource } from '@/shared/constants/report-reason';
import type { QuestionType } from '@/shared/constants/question-type';

/**
 * The question a report was filed against, frozen at the moment it was filed.
 *
 * Its own declaration rather than the persistence record's or the DTO's: the
 * three used to be one interface in src/shared/types/report.ts, which made the
 * stored shape, the domain shape and the wire shape move together whether or
 * not that was intended.
 */
export interface ReportQuestionSnapshot {
  id: string;
  index: number;
  question: string;
  options: string[];
  type: QuestionType;
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export interface Report {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  questionId?: string;
  questionSnapshot?: ReportQuestionSnapshot;
  reporterEmail: string;
  reporterName: string;
  content: string;
  reason?: ReportReason;
  source?: ReportSource;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}
