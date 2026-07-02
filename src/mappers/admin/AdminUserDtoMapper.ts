import type { AdminUserDto, AdminUserListDto } from '@/dtos/admin-user';
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
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: serializeDate(user.createdAt, 'user.createdAt'),
      subscription: user.subscription
        ? {
            type: user.subscription.type,
            startDate: serializeOptionalDate(
              user.subscription.startDate,
              'user.subscription.startDate',
            ),
            endDate: serializeOptionalDate(user.subscription.endDate, 'user.subscription.endDate'),
            isActive: user.subscription.isActive,
          }
        : undefined,
    };
  }
}
