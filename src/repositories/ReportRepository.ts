import connectDB from '@/lib/mongoose';
import Report from '@/models/Report';
import { buildPaginationMeta } from '@/repositories/pagination';
import { BaseRepository } from '@/repositories/base';
import { IReport, IReportRepository } from '@/interfaces/repositories/IReportRepository';

export class ReportRepository extends BaseRepository<IReport> implements IReportRepository {
  constructor() {
    super(Report);
  }

  override async findById(id: string): Promise<IReport | null> {
    await connectDB();
    return (await Report.findById(id)
      .populate('quiz', 'title slug')
      .populate('reporter', 'email')
      .lean()) as unknown as IReport | null;
  }

  async findAll(
    options: {
      page?: number;
      limit?: number;
      status?: string;
    } = {},
  ): Promise<{
    reports: IReport[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    await connectDB();

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    if (options.status) {
      query.status = options.status;
    }

    const reports = (await Report.find(query)
      .populate('quiz', 'title slug')
      .populate('reporter', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as IReport[];

    const totalItems = await Report.countDocuments(query);

    return {
      reports,
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  override async update(id: string, reportData: Partial<IReport>): Promise<IReport | null> {
    await connectDB();
    return (await Report.findByIdAndUpdate(id, reportData, { new: true })
      .populate('quiz', 'title slug')
      .populate('reporter', 'email')
      .lean()) as unknown as IReport | null;
  }
}
