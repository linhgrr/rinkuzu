import type { AdminUserDto, AdminUserListDto, AdminUserSubscriptionDto } from '@/dtos/admin-user';
import { formatDate } from '@/lib/formatters';
import type {
  AdminUserListViewModel,
  AdminUserSubscriptionViewModel,
  AdminUserViewModel,
} from '@/features/admin/users/types/admin-users-view-model';

function toAdminUserSubscriptionViewModel(
  subscription: AdminUserSubscriptionDto | undefined,
): AdminUserSubscriptionViewModel | undefined {
  if (!subscription) return undefined;

  const isLifetime = subscription.type === 'lifetime';
  const statusLabel = !subscription.isActive ? 'inactive' : isLifetime ? 'lifetime' : 'active';
  const statusVariant = !subscription.isActive ? 'danger' : isLifetime ? 'warning' : 'success';

  return {
    type: subscription.type,
    startDate: subscription.startDate,
    startDateLabel: subscription.startDate ? formatDate(subscription.startDate) : undefined,
    endDate: subscription.endDate,
    endDateLabel: subscription.endDate ? formatDate(subscription.endDate) : undefined,
    isActive: subscription.isActive,
    statusLabel,
    statusVariant,
  };
}

export function toAdminUserViewModel(user: AdminUserDto): AdminUserViewModel {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
    createdAtLabel: formatDate(user.createdAt),
    subscription: toAdminUserSubscriptionViewModel(user.subscription),
  };
}

export function toAdminUserListViewModel(dto: AdminUserListDto): AdminUserListViewModel {
  return {
    users: dto.users.map(toAdminUserViewModel),
    pagination: {
      page: dto.pagination.currentPage,
      limit: dto.pagination.itemsPerPage,
      total: dto.pagination.totalItems,
      totalPages: dto.pagination.totalPages,
    },
  };
}
