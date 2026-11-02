import type { AdminLearnerIdentityDto, AdminLearnerSearchDto } from '@/dtos/admin-learner';
import type { UserIdentity } from '@/interfaces/repositories/IUserIdentityRepository';

export class AdminLearnerDtoMapper {
  /** Rebuilt field by field so nothing else a repository returns can leak. */
  static toIdentity({ id, email, displayName }: UserIdentity): AdminLearnerIdentityDto {
    return { id, displayName: displayName ?? null, email };
  }

  static toSearch(identities: readonly UserIdentity[]): AdminLearnerSearchDto {
    return { learners: identities.map(AdminLearnerDtoMapper.toIdentity) };
  }
}
