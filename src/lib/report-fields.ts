import type { QuizQuestion } from '@/entities/Quiz';
import type { ReportQuestionSnapshot } from '@/entities/Report';
import type { ReportStatus } from '@/shared/constants/report-status';

/**
 * The fields a report carries across every representation of it, as this
 * helper's input contract -- not as a type any layer derives from.
 *
 * The domain entity and the admin DTO each declare their own shape and both
 * happen to satisfy this one, which is the point: if either drifts, the call in
 * its mapper stops compiling instead of the two silently moving together the
 * way they did while all three layers shared src/shared/types/report.ts.
 */
export interface IdentifiedReportCoreFields {
  id: string;
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

export function copyReportCoreFields(
  report: IdentifiedReportCoreFields,
): IdentifiedReportCoreFields {
  return {
    id: report.id,
    quizId: report.quizId,
    quizTitle: report.quizTitle,
    quizSlug: report.quizSlug,
    ...(report.questionId !== undefined && { questionId: report.questionId }),
    ...(report.questionSnapshot !== undefined && {
      questionSnapshot: report.questionSnapshot,
    }),
    reporterEmail: report.reporterEmail,
    reporterName: report.reporterName,
    content: report.content,
    status: report.status,
  };
}

export function toReportQuestionSnapshot(
  question: QuizQuestion,
  index: number,
): ReportQuestionSnapshot {
  return {
    id: question.id,
    index,
    question: question.question,
    options: [...question.options],
    type: question.type,
    ...(question.type === 'single'
      ? { correctIndex: question.correctIndex }
      : { correctIndexes: [...question.correctIndexes] }),
    ...(question.questionImage !== undefined ? { questionImage: question.questionImage } : {}),
    ...(question.optionImages !== undefined ? { optionImages: [...question.optionImages] } : {}),
  };
}
