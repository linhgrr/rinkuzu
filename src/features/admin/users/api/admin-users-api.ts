import type { AdminMessageDto, AdminUserListDto } from '@/dtos/admin-user';
import type { AdminUserSubscriptionGrantDto } from '@/dtos/admin-billing';
import { fetchApiData } from '@/lib/api/client';
import { toAdminUserListViewModel } from '@/features/admin/users/mappers/admin-users.mapper';
import type {
  AdminUserListViewModel,
  AdminUserRoleViewModel,
} from '@/features/admin/users/types/admin-users-view-model';

export async function fetchAdminUserListViewModel(url: string): Promise<AdminUserListViewModel> {
  const data = await fetchApiData<AdminUserListDto>(url);
  return toAdminUserListViewModel(data);
}

export async function updateAdminUserRole({
  userId,
  role,
}: {
  userId: string;
  role: AdminUserRoleViewModel;
}): Promise<void> {
  await fetchApiData<AdminMessageDto>('/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await fetchApiData<null>(`/api/admin/users?userId=${userId}`, {
    method: 'DELETE',
  });
}

export async function grantAdminUserSubscription({
  userId,
  planId,
}: {
  userId: string;
  planId: string;
}): Promise<void> {
  await fetchApiData<AdminUserSubscriptionGrantDto>('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, planId }),
  });
}
