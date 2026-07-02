import type { PaginationMeta } from '@/dtos/common';

/**
 * Build a standardized PaginationMeta object from raw pagination parameters.
 *
 * This is shared application infrastructure, not repository-specific logic.
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number,
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
