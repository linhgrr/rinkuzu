import type {
  AdminMessageDto,
  AdminUserCreditGrantDto,
  AdminUserListDto,
  AdminUserStatusDto,
} from '@/dtos/admin-user';
import type { AdminUserSubscriptionGrantDto } from '@/dtos/admin-billing';
import { fetchApiData } from '@/lib/api/client';
import { toAdminUserListViewModel } from '@/features/admin/users/mappers/admin-users.mapper';
import type {
  AdminUserListViewModel,
  AdminUserCreditGrantInput,
  AdminUserRoleUpdateInput,
  AdminUserStatusUpdateInput,
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

export async function updateAdminUserStatus({
  userId,
  disable,
}: AdminUserStatusUpdateInput): Promise<AdminUserStatusDto> {
  return fetchApiData<AdminUserStatusDto>(`/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disable }),
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

export async function grantAdminUserCredits({
  userId,
  amount,
  note,
  idempotencyKey,
}: AdminUserCreditGrantInput): Promise<AdminUserCreditGrantDto> {
  return fetchApiData<AdminUserCreditGrantDto>(`/api/admin/users/${userId}/credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, note, idempotencyKey }),
  });
}
