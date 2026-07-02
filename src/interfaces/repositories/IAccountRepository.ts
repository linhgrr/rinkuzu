import type { AccountCredentials, AccountProfile } from '@/entities/Account';

export interface AccountProfileUpdate {
  displayName?: string;
  bio?: string;
}

export interface IAccountRepository {
  findProfileByEmail(email: string): Promise<AccountProfile | null>;

  updateProfileByEmail(email: string, update: AccountProfileUpdate): Promise<AccountProfile | null>;

  findCredentialsByEmail(email: string): Promise<AccountCredentials | null>;

  updatePasswordHash(email: string, passwordHash: string): Promise<boolean>;

  updateAvatar(email: string, avatarUrl: string): Promise<boolean>;

  clearAvatar(email: string): Promise<boolean>;
}
