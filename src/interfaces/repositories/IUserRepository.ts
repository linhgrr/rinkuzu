import type { PublicProfileUser, User } from '@/entities/User';
import type {
  CountBuckets,
  CountBucketThresholds,
  CreatedAtCountFilter,
  PaginatedRepositoryResult,
} from '@/interfaces/repositories/types';

export interface UserFindOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

export interface UserRoleCount {
  role: string;
  count: number;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findPublicProfileById(id: string): Promise<PublicProfileUser | null>;
  updateRole(id: string, role: User['role']): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  findAll(options?: UserFindOptions): Promise<PaginatedRepositoryResult<User>>;
  count(filter?: CreatedAtCountFilter): Promise<number>;
  countByCreatedAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets>;
  countByRole(): Promise<UserRoleCount[]>;
}
