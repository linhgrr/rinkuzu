import type { ReportStatus } from '@/shared/constants/report-status';
import type { QuestionType } from '@/shared/constants/question-type';
import type { MongoIdLike } from '@/types/mongo';

/**
 * The reported question as the document stores it.
 *
 * Spelled out rather than derived from the presentation snapshot. Until
 * 2026-08-31 all three layers shared one src/shared/types/report.ts: the model,
 * the repository record, the entity and the DTO were the same interface, so a
 * field added for the admin screen was also a field this collection was
 * expected to hold, and a stored field renamed here changed the wire shape
 * without anything saying so.
 */
export interface ReportQuestionSnapshotPersistence {
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

/** Every field the reports collection carries, apart from its identifier. */
export interface ReportPersistenceFields {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  questionId?: string;
  questionSnapshot?: ReportQuestionSnapshotPersistence;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}

export interface ReportPersistenceRecord extends ReportPersistenceFields {
  _id: MongoIdLike;
}
