import connectDB from '@/lib/mongoose';
import Report from '@/models/Report';
import { INDEX_HOLD_REPORT_REASONS } from '@/shared/constants/report-reason';
import { buildPaginationMeta } from '@/lib/pagination';
import type {
  CreateQuizPageReportData,
  CreateReportData,
  IIndexHoldReportRepository,
  IQuizPageReportRepository,
  IReportRepository,
  ReportFindOptions,
  UpdateReportData,
} from '@/interfaces/repositories/IReportRepository';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import type { Report as ReportEntity } from '@/entities/Report';
import { ReportPersistenceMapper } from '@/repositories/mappers/ReportPersistenceMapper';
import type { ReportPersistenceRecord } from '@/repositories/types/ReportPersistence';

interface ReportQuery {
  status?: string;
  reason?: string;
}

const INDEX_HOLD_REASONS: string[] = [...INDEX_HOLD_REPORT_REASONS];

export class ReportRepository
  implements IReportRepository, IQuizPageReportRepository, IIndexHoldReportRepository
{
  async findById(id: string): Promise<ReportEntity | null> {
    await connectDB();
    const record = await Report.findById(id).lean<ReportPersistenceRecord>();
    return record ? ReportPersistenceMapper.toEntity(record) : null;
  }

  async findAll(options: ReportFindOptions): Promise<PaginatedRepositoryResult<ReportEntity>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Build query
    const query: ReportQuery = {};
    if (options.status) {
      query.status = options.status;
    }
    if (options.reason) {
      query.reason = options.reason;
    }

    // The rank is computed, so this sorts the filtered set in memory. The
    // collection holds hundreds of reports, well inside the 100 MB sort limit.
    const [records, totalItems] = await Promise.all([
      Report.aggregate<ReportPersistenceRecord>([
        { $match: query },
        {
          $addFields: {
            holdRank: { $cond: [{ $in: ['$reason', INDEX_HOLD_REASONS] }, 0, 1] },
          },
        },
        { $sort: { holdRank: 1, createdAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { holdRank: 0, ipHash: 0 } },
      ]),
      Report.countDocuments(query),
    ]);

    return {
      items: records.map(ReportPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async create(reportData: CreateReportData): Promise<ReportEntity> {
    await connectDB();
    const document = await Report.create(reportData);
    const record: ReportPersistenceRecord = document.toObject();
    return ReportPersistenceMapper.toEntity(record);
  }

  async createQuizPageReport(reportData: CreateQuizPageReportData): Promise<ReportEntity> {
    await connectDB();
    const document = await Report.create({
      ...reportData,
      source: 'quiz_page',
      status: 'pending',
    });
    const record: ReportPersistenceRecord = document.toObject();
    return ReportPersistenceMapper.toEntity(record);
  }

  async countPendingIndexHoldReports(quizId?: string): Promise<number> {
    await connectDB();
    return Report.countDocuments({
      status: 'pending',
      reason: { $in: INDEX_HOLD_REASONS },
      ...(quizId === undefined ? {} : { quizId }),
    });
  }

  async update(id: string, reportData: UpdateReportData): Promise<ReportEntity | null> {
    await connectDB();
    const $set = {
      status: reportData.status,
      ...(reportData.resolution !== null && {
        resolvedAt: reportData.resolution.resolvedAt,
        resolvedBy: reportData.resolution.resolvedBy,
      }),
      ...(reportData.adminNotes !== undefined && { adminNotes: reportData.adminNotes }),
    };
    const update =
      reportData.resolution === null
        ? { $set, $unset: { resolvedAt: 1, resolvedBy: 1 } }
        : { $set };
    const record = await Report.findByIdAndUpdate(id, update, {
      new: true,
    }).lean<ReportPersistenceRecord>();
    return record ? ReportPersistenceMapper.toEntity(record) : null;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    const result = await Report.findByIdAndDelete(id);
    return result !== null;
  }
}
