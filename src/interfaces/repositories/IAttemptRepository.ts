import type { Attempt } from '@/entities/Attempt';
import type {
  CountBuckets,
  CountBucketThresholds,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';
import type { AttemptResultFilter } from '@/shared/constants/attempt-result';

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

/** Quiz history page query; `result` narrows the list, never the summary (RIN-1197). */
export interface AttemptHistoryQuery extends RepositoryPaginationOptions {
  result?: AttemptResultFilter | undefined;
}

/** Totals over every attempt of the user, whatever the filter or page. */
export interface AttemptHistorySummary {
  totalAttempts: number;
  /** Mean score in percent, one decimal; `null` with no attempts. */
  averageScore: number | null;
  needsWorkCount: number;
}

export interface AttemptHistoryPage extends PaginatedRepositoryResult<Attempt> {
  summary: AttemptHistorySummary;
}

export interface IAttemptRepository {
  findByUser(userId: string, options: AttemptHistoryQuery): Promise<AttemptHistoryPage>;

  findRecentActivity(limit: number): Promise<RecentAttemptActivity[]>;

  findByIdWithQuiz(attemptId: string, owner: AttemptOwnerIdentity): Promise<Attempt | null>;

  count(filter?: AttemptCountFilter): Promise<number>;

  countByTakenAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets>;

  scoreStats(): Promise<AttemptScoreStats>;
}
