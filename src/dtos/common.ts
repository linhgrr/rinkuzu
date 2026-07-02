/** Pagination metadata returned by list endpoints. */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** Standard payload returned by delete operations. */
export interface DeleteResultDto {
  id: string;
  deleted: true;
}
