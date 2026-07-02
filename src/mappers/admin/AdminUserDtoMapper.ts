import type { AdminUserDto } from '@/dtos/admin-user';
import type { User } from '@/entities/User';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

export class AdminUserDtoMapper {
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
