import type { Attempt } from '@/entities/Attempt';
import type {
  CountBuckets,
  CountBucketThresholds,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export type AttemptOwnerIdentity =
  | { userId: string; guestEmail?: never; guestClaimTokenHash?: never }
  | { userId?: never; guestEmail: string; guestClaimTokenHash?: never }
  | { userId?: never; guestEmail?: never; guestClaimTokenHash: string };

interface AttemptTakenAtFilter {
  $gte: Date;
}

export interface AttemptCountFilter {
  takenAt?: AttemptTakenAtFilter;
}

export interface AttemptScoreStats {
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

export interface RecentAttemptActivity {
  id: string;
  userEmail?: string;
  guestEmail?: string;
  /** True for an unclaimed guest attempt identified only by a claim token. */
  isClaimTokenGuest?: boolean;
  quizTitle?: string;
  score: number;
  answeredQuestions: number;
  takenAt: Date;
}

export interface IAttemptRepository {
  findByUser(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Attempt>>;

  findRecentActivity(limit: number): Promise<RecentAttemptActivity[]>;

  findByIdWithQuiz(attemptId: string, owner: AttemptOwnerIdentity): Promise<Attempt | null>;

  count(filter?: AttemptCountFilter): Promise<number>;

  countByTakenAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets>;

  scoreStats(): Promise<AttemptScoreStats>;
}
