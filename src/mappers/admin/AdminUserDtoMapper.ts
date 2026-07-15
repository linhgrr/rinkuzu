import type { AdminUserDto, AdminUserListDto, AdminUserSubscriptionDto } from '@/dtos/admin-user';
import type { PaginationMeta } from '@/dtos/common';
import type { User } from '@/entities/User';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

export class AdminUserDtoMapper {
  static toListDto(users: User[], pagination: PaginationMeta): AdminUserListDto {
    return {
      users: users.map(AdminUserDtoMapper.toDto),
      pagination,
    };
  }

  static toDto(user: User): AdminUserDto {
    let subscription: AdminUserSubscriptionDto | undefined;
    if (user.subscription) {
      const startDate = serializeOptionalDate(
        user.subscription.startDate,
        'user.subscription.startDate',
      );
      const endDate = serializeOptionalDate(user.subscription.endDate, 'user.subscription.endDate');
      subscription = {
        type: user.subscription.type,
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        isActive: user.subscription.isActive,
      };
    }

    return {
      id: user.id,
      email: user.email,
      ...(user.displayName !== undefined && { displayName: user.displayName }),
      role: user.role,
      createdAt: serializeDate(user.createdAt, 'user.createdAt'),
      ...(subscription !== undefined && { subscription }),
    };
  }
}
