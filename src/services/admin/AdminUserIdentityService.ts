import type { AdminLearnerSearchDto } from '@/dtos/admin-learner';
import type { IUserIdentityRepository } from '@/interfaces/repositories/IUserIdentityRepository';
import type { ServiceResult } from '@/interfaces/services/types';
import { logger } from '@/lib/logger';
import { AdminLearnerDtoMapper } from '@/mappers/admin/AdminLearnerDtoMapper';

/** Small on purpose: admins refine the term rather than page through learners. */
const LEARNER_SEARCH_LIMIT = 20;

export class AdminUserIdentityService {
  constructor(private userIdentityRepository: IUserIdentityRepository) {}

  async searchLearners(search: string): Promise<ServiceResult<AdminLearnerSearchDto>> {
    try {
      const identities = await this.userIdentityRepository.findByNameOrEmail(
        search,
        LEARNER_SEARCH_LIMIT,
      );
      return { success: true, data: AdminLearnerDtoMapper.toSearch(identities) };
    } catch (error) {
      logger.error({ error }, 'Search learners error');
      return { success: false, error: 'Failed to search learners', statusCode: 500 };
    }
  }
}
