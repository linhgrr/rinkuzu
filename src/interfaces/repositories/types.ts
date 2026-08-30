export interface RepositoryPaginationOptions {
  page: number;
  limit: number;
}

/**
 * What a paginated repository read reports about the page it returned.
 *
 * Structurally identical to the DTO's PaginationMeta, and separate on purpose:
 * importing the DTO here would make every repository signature move whenever
 * the client's pagination envelope does.
 */
interface RepositoryPaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedRepositoryResult<T> {
  items: T[];
  pagination: RepositoryPaginationMeta;
}

interface CreatedAtRangeFilter {
  $gte: Date;
}

export interface CreatedAtCountFilter {
  createdAt?: CreatedAtRangeFilter;
}

export interface CountBucketThresholds {
  today: Date;
  thisWeek: Date;
  thisMonth: Date;
}

export interface CountBuckets {
  today: number;
  thisWeek: number;
  thisMonth: number;
}
