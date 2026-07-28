import type {
  AdminReportDto,
  AdminReportListDto,
  AdminReportedQuestionDto,
} from '@/dtos/admin-report';
import type { PaginationMeta } from '@/dtos/common';
import type { Report } from '@/entities/Report';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';
import { copyReportCoreFields } from '@/lib/report-fields';
import type { QuizQuestion } from '@/entities/Quiz';

export class AdminReportDtoMapper {
  static toQuestionDto(question: QuizQuestion, index: number): AdminReportedQuestionDto {
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

  static toListDto(reports: Report[], pagination: PaginationMeta): AdminReportListDto {
    return {
      reports: reports.map(AdminReportDtoMapper.toDto),
      pagination,
    };
  }

  static toDto(report: Report): AdminReportDto {
    const resolvedAt = serializeOptionalDate(report.resolvedAt, 'report.resolvedAt');

    return {
      ...copyReportCoreFields(report),
      createdAt: serializeDate(report.createdAt, 'report.createdAt'),
      updatedAt: serializeDate(report.updatedAt, 'report.updatedAt'),
      ...(resolvedAt !== undefined && { resolvedAt }),
      ...(report.resolvedBy !== undefined && { resolvedBy: report.resolvedBy }),
      ...(report.adminNotes !== undefined && { adminNotes: report.adminNotes }),
    };
  }
}
