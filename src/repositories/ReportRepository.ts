import connectDB from '@/lib/mongoose';
import Report from '@/models/Report';
import { buildPaginationMeta } from '@/lib/pagination';
import type {
  CreateReportData,
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
}

export class ReportRepository implements IReportRepository {
  async findById(id: string): Promise<ReportEntity | null> {
    await connectDB();
    const record = await Report.findById(id).lean<ReportPersistenceRecord>();
    return record ? ReportPersistenceMapper.toEntity(record) : null;
  }

  async findAll(options: ReportFindOptions = {}): Promise<PaginatedRepositoryResult<ReportEntity>> {
    await connectDB();

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query: ReportQuery = {};
    if (options.status) {
      query.status = options.status;
    }

    const [records, totalItems] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ReportPersistenceRecord[]>(),
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

  async update(id: string, reportData: UpdateReportData): Promise<ReportEntity | null> {
    await connectDB();
    const record = await Report.findByIdAndUpdate(id, reportData, {
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
