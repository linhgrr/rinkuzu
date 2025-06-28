export interface IReport {
  _id?: string
  quiz: string
  reporter: string
  reason: string
  description?: string
  status: 'pending' | 'reviewed' | 'resolved'
  createdAt?: Date
  updatedAt?: Date
}

export interface IReportRepository {
  findById(id: string): Promise<IReport | null>
  
  findAll(options?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<{
    reports: IReport[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }>
  
  create(reportData: Partial<IReport>): Promise<IReport>
  
  update(id: string, reportData: Partial<IReport>): Promise<IReport | null>
  
  delete(id: string): Promise<boolean>
  
  count(filter?: any): Promise<number>
} 