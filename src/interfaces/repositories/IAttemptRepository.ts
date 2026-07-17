import type { Attempt } from '@/entities/Attempt';
import type {
  CountBuckets,
  CountBucketThresholds,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export type AttemptOwnerIdentity =
  | { userId: string; guestEmail?: never }
  | { userId?: never; guestEmail: string };

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

  countByUser(userId: string): Promise<number>;

  countByQuiz(quizId: string): Promise<number>;

  findRecentActivity(limit: number): Promise<RecentAttemptActivity[]>;

  findByIdWithQuiz(attemptId: string, owner: AttemptOwnerIdentity): Promise<Attempt | null>;

  count(filter?: AttemptCountFilter): Promise<number>;

  countByTakenAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets>;

  scoreStats(): Promise<AttemptScoreStats>;
}
