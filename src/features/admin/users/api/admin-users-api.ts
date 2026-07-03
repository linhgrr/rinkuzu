import type { AdminMessageDto, AdminUserListDto } from '@/dtos/admin-user';
import type { AdminUserSubscriptionGrantDto } from '@/dtos/admin-billing';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import { toAdminUserListViewModel } from '@/features/admin/users/mappers/admin-users.mapper';
import type {
  AdminUserListViewModel,
  AdminUserRoleUpdateInput,
  AdminUserSubscriptionGrantInput,
} from '@/features/admin/users/types/admin-users-view-model';

export async function fetchAdminUserListViewModel(url: string): Promise<AdminUserListViewModel> {
  const data = await fetchApiData<AdminUserListDto>(url);
  return toAdminUserListViewModel(data);
}

export async function updateAdminUserRole({
  userId,
  role,
}: AdminUserRoleUpdateInput): Promise<AdminMessageDto> {
  return fetchApiData<AdminMessageDto>('/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
}

export async function deleteAdminUser(userId: string): Promise<DeleteResultDto> {
  return fetchApiData<DeleteResultDto>(`/api/admin/users?userId=${userId}`, {
    method: 'DELETE',
  });
}

export async function grantAdminUserSubscription({
  userId,
  planId,
}: AdminUserSubscriptionGrantInput): Promise<AdminUserSubscriptionGrantDto> {
  return fetchApiData<AdminUserSubscriptionGrantDto>('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, planId }),
  });
}
