import type { User } from '@/entities/User';

export interface IRecentUserRepository {
  findRecent(limit: number): Promise<User[]>;
}
