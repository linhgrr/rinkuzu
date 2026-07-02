import type { PaginationMeta } from '@/dtos/common';

export interface RepositoryPaginationOptions {
  page?: number;
  limit?: number;
}

export interface RequiredRepositoryPaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedRepositoryResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface CreatedAtRangeFilter {
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
