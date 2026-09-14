import type { AdminUserIdentityDto } from '@/dtos/admin-personal-learning';
import type { IUserIdentityRepository } from '@/interfaces/repositories/IUserIdentityRepository';
import type { IAdminUserIdentityService } from '@/interfaces/services/IAdminUserIdentityService';
import { logger } from '@/lib/logger';

export class AdminUserIdentityService implements IAdminUserIdentityService {
  constructor(private userIdentityRepository: IUserIdentityRepository) {}

  async getUserIdentities(userIds: readonly string[]): Promise<Map<string, AdminUserIdentityDto>> {
    if (userIds.length === 0) return new Map();
    try {
      const identities = await this.userIdentityRepository.findIdentitiesByIds(userIds);
      return new Map(identities.map((identity) => [identity.id, identity]));
    } catch (error) {
      logger.error({ error }, 'Get user identities error');
      return new Map();
    }
  }

  async findUserIdsByNameOrEmail(search: string, limit: number): Promise<string[]> {
    try {
      return await this.userIdentityRepository.findIdsByNameOrEmail(search, limit);
    } catch (error) {
      logger.error({ error }, 'Search user identities error');
      return [];
    }
  }
}
