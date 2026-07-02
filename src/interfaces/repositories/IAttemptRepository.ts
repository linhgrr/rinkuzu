import type { Attempt, AttemptAnswer } from '@/entities/Attempt';
import type {
  CountBuckets,
  CountBucketThresholds,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

interface AttemptSubmissionData {
  quizId: string;
  answers: AttemptAnswer[];
  score: number;
  totalQuestions: number;
  takenAt: Date;
}

export type CreateAttemptData =
  | (AttemptSubmissionData & {
      userId: string;
      guestEmail?: never;
    })
  | (AttemptSubmissionData & {
      userId?: never;
      guestEmail: string;
    });

export type AttemptOwnerIdentity =
  | { userId: string; guestEmail?: never }
  | { userId?: never; guestEmail: string };

export interface AttemptTakenAtFilter {
  $gte: Date;
}

export interface AttemptCountFilter {
  takenAt?: AttemptTakenAtFilter;
}

export interface IAttemptRepository {
  findByUser(
    userId: string,
    options?: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Attempt>>;

  create(data: CreateAttemptData): Promise<Attempt>;

  countByUser(userId: string): Promise<number>;

  countByQuiz(quizId: string): Promise<number>;

  findRecentActivity(limit?: number): Promise<Attempt[]>;

  findByIdWithQuiz(attemptId: string, owner: AttemptOwnerIdentity): Promise<Attempt | null>;

  count(filter?: AttemptCountFilter): Promise<number>;

  countByTakenAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets>;
}
