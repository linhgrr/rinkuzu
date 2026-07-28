import type { Report } from '@/entities/Report';
import { serializeId } from '@/lib/mongo-id';
import type { ReportPersistenceRecord } from '@/repositories/types/ReportPersistence';

export class ReportPersistenceMapper {
  static toEntity(record: ReportPersistenceRecord): Report {
    return {
      id: serializeId(record._id, 'report._id'),
      quizId: record.quizId,
      quizTitle: record.quizTitle,
      quizSlug: record.quizSlug,
      ...(record.questionId === undefined ? {} : { questionId: record.questionId }),
      ...(record.questionSnapshot === undefined
        ? {}
        : { questionSnapshot: record.questionSnapshot }),
      reporterEmail: record.reporterEmail,
      reporterName: record.reporterName,
      content: record.content,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.resolvedAt === undefined ? {} : { resolvedAt: record.resolvedAt }),
      ...(record.resolvedBy === undefined ? {} : { resolvedBy: record.resolvedBy }),
      ...(record.adminNotes === undefined ? {} : { adminNotes: record.adminNotes }),
    };
  }
}
