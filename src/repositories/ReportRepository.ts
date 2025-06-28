import connectDB from '@/lib/mongoose'
import Report from '@/models/Report'
import { IReport, IReportRepository } from '@/interfaces/repositories/IReportRepository'

export class ReportRepository implements IReportRepository {
  async findById(id: string): Promise<IReport | null> {
    await connectDB()
    return await Report.findById(id)
      .populate('quiz', 'title slug')
      .populate('reporter', 'email')
      .lean()
  }

  async findAll(options: {
    page?: number
    limit?: number
    status?: string
  } = {}): Promise<{
    reports: IReport[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }> {
    await connectDB()
    
    const page = options.page || 1
    const limit = options.limit || 10
    const skip = (page - 1) * limit

    // Build query
    const query: any = {}
    if (options.status) {
      query.status = options.status
    }

    const reports = await Report.find(query)
      .populate('quiz', 'title slug')
      .populate('reporter', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const totalItems = await Report.countDocuments(query)
    const totalPages = Math.ceil(totalItems / limit)

    return {
      reports,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  }

  async create(reportData: Partial<IReport>): Promise<IReport> {
    await connectDB()
    const report = new Report(reportData)
    return await report.save()
  }

  async update(id: string, reportData: Partial<IReport>): Promise<IReport | null> {
    await connectDB()
    return await Report.findByIdAndUpdate(id, reportData, { new: true })
      .populate('quiz', 'title slug')
      .populate('reporter', 'email')
      .lean()
  }

  async delete(id: string): Promise<boolean> {
    await connectDB()
    const result = await Report.findByIdAndDelete(id)
    return !!result
  }

  async count(filter: any = {}): Promise<number> {
    await connectDB()
    return await Report.countDocuments(filter)
  }
} 