import type { QuizQuestion } from '@/entities/Quiz';
import type { ReportCoreFields, ReportQuestionSnapshot } from '@/shared/types/report';

export interface IdentifiedReportCoreFields extends ReportCoreFields {
  id: string;
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
