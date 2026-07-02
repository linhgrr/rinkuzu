import type { FilterQuery } from 'mongoose';

export type MongoFilter<T> = FilterQuery<T>;

export function buildMongoOrFilter<T>(filters: Array<MongoFilter<T> | null>): MongoFilter<T> {
  const activeFilters = filters.filter((filter): filter is MongoFilter<T> => filter !== null);
  if (activeFilters.length === 0) {
    throw new Error('buildMongoOrFilter requires at least one filter');
  }
  if (activeFilters.length === 1) return activeFilters[0];
  return { $or: activeFilters } as MongoFilter<T>;
}
