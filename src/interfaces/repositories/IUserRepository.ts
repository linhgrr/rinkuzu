import type { PublicProfileUser, User, UserSubscriptionSnapshot } from '@/entities/User';
import type { AdminMutationInput, AdminMutationResult } from '@/entities/AdminMutation';
import type {
  CountBuckets,
  CountBucketThresholds,
  CreatedAtCountFilter,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';
import type { AccountDisableState } from '@/shared/constants/account-disable';

export interface UserFindOptions extends RepositoryPaginationOptions {
  search?: string;
  role?: string;
  /** When set, filter exact disable state; when omitted, include all (admin lists). */
  disable?: AccountDisableState;
}

export interface UserRoleCount {
  role: string;
  count: number;
}

export interface IUserRepository {
  /** Active accounts only (`disable: 0`). */
  findByEmail(email: string): Promise<User | null>;
  /** Active accounts only (`disable: 0`). */
  findById(id: string): Promise<User | null>;
  /** Admin-inclusive read; returns active and disabled accounts. */
  findByIdIncludingDisabled(id: string): Promise<User | null>;
  /** Active accounts only — subscription eligibility. */
  findSubscriptionById(id: string): Promise<UserSubscriptionSnapshot | null>;
  /** Active accounts only — public profile. */
  findPublicProfileById(id: string): Promise<PublicProfileUser | null>;
  /**
   * Transactional admin role/status mutation with active-admin fence serialization.
   * Touch fence first, re-read actor+target, enforce last-active-admin, then mutate.
   * Throws typed domain errors from `@/entities/AdminMutation`.
   */
  applyAdminMutation(mutation: AdminMutationInput): Promise<AdminMutationResult>;
  findAll(options: UserFindOptions): Promise<PaginatedRepositoryResult<User>>;
  count(filter?: CreatedAtCountFilter): Promise<number>;
  countByCreatedAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets>;
  countByRole(): Promise<UserRoleCount[]>;
}
