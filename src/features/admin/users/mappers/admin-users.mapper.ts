import type { AdminUserDto, AdminUserListDto, AdminUserSubscriptionDto } from '@/dtos/admin-user';
import { formatDate } from '@/lib/formatters';
import type {
  AdminUserListViewModel,
  AdminUserSubscriptionViewModel,
  AdminUserViewModel,
} from '@/features/admin/users/types/admin-users-view-model';
import { ACCOUNT_DISABLE_DISABLED } from '@/shared/constants/account-disable';

function toAdminUserSubscriptionViewModel(
  subscription: AdminUserSubscriptionDto | undefined,
): AdminUserSubscriptionViewModel | undefined {
  if (!subscription) return undefined;

  const statusLabel = !subscription.isActive ? 'inactive' : 'active';
  const statusVariant = !subscription.isActive ? 'danger' : 'success';

  return {
    type: subscription.type,
    ...(subscription.startDate !== undefined && {
      startDate: subscription.startDate,
      startDateLabel: formatDate(subscription.startDate),
    }),
    ...(subscription.endDate !== undefined && {
      endDate: subscription.endDate,
      endDateLabel: formatDate(subscription.endDate),
    }),
    isActive: subscription.isActive,
    statusLabel,
    statusVariant,
  };
}

function toAdminUserViewModel(user: AdminUserDto): AdminUserViewModel {
  const subscription = toAdminUserSubscriptionViewModel(user.subscription);
  const isDisabled = user.disable === ACCOUNT_DISABLE_DISABLED;
  const disabledAtLabel =
    user.disabledAt === undefined || user.disabledAt === null
      ? undefined
      : formatDate(user.disabledAt);

  return {
    id: user.id,
    email: user.email,
    ...(user.displayName !== undefined && { displayName: user.displayName }),
    role: user.role,
    disable: user.disable,
    ...(user.disabledAt !== undefined && { disabledAt: user.disabledAt }),
    ...(disabledAtLabel !== undefined && { disabledAtLabel }),
    accountStatusLabel: isDisabled ? 'accountDisabled' : 'accountActive',
    accountStatusVariant: isDisabled ? 'danger' : 'success',
    createdAt: user.createdAt,
    createdAtLabel: formatDate(user.createdAt),
    ...(subscription !== undefined && { subscription }),
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
