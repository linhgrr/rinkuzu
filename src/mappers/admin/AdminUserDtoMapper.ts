import type {
  AdminUserDto,
  AdminUserListDto,
  AdminUserStatusDto,
  AdminUserSubscriptionDto,
} from '@/dtos/admin-user';
import type { PaginationMeta } from '@/dtos/common';
import type { User } from '@/entities/User';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';
import type { AccountDisableState } from '@/shared/constants/account-disable';

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

    const disabledAt =
      user.disabledAt === undefined
        ? undefined
        : user.disabledAt === null
          ? null
          : serializeDate(user.disabledAt, 'user.disabledAt');

    return {
      id: user.id,
      email: user.email,
      ...(user.displayName !== undefined && { displayName: user.displayName }),
      role: user.role,
      disable: user.disable,
      ...(disabledAt !== undefined && { disabledAt }),
      createdAt: serializeDate(user.createdAt, 'user.createdAt'),
      ...(subscription !== undefined && { subscription }),
    };
  }

  static toStatusDto(
    user: User,
    changed: boolean,
    target: AccountDisableState,
  ): AdminUserStatusDto {
    const disabledAt =
      user.disabledAt === undefined
        ? undefined
        : user.disabledAt === null
          ? null
          : serializeDate(user.disabledAt, 'user.disabledAt');

    return {
      id: user.id,
      disable: user.disable,
      changed,
      ...(disabledAt !== undefined && { disabledAt }),
      message:
        target === 1
          ? changed
            ? 'User disabled successfully'
            : 'User already disabled'
          : changed
            ? 'User restored successfully'
            : 'User already active',
    };
  }
}
