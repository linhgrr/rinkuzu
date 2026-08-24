import type { UserRole } from '@/types/next-auth';
import type { AccountDisableState } from '@/shared/constants/account-disable';

export interface AdminUserSubscriptionViewModel {
  plan: {
    id: string;
    name: string;
  };
  startDate?: string;
  startDateLabel?: string;
  endDate?: string;
  endDateLabel?: string;
  isActive: boolean;
  statusLabel: 'noSubscription' | 'inactive' | 'active';
  statusVariant: 'default' | 'danger' | 'success';
}

export interface AdminUserViewModel {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  disable: AccountDisableState;
  disabledAt?: string | null;
  disabledAtLabel?: string;
  accountStatusLabel: 'accountActive' | 'accountDisabled';
  accountStatusVariant: 'success' | 'danger';
  createdAt: string;
  createdAtLabel: string;
  subscription?: AdminUserSubscriptionViewModel;
}

export interface AdminUsersPaginationViewModel {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUserListViewModel {
  users: AdminUserViewModel[];
  pagination: AdminUsersPaginationViewModel;
}

export interface AdminUserRoleUpdateInput {
  userId: string;
  role: UserRole;
}

export interface AdminUserStatusUpdateInput {
  userId: string;
  disable: AccountDisableState;
}

export interface AdminUserSubscriptionGrantInput {
  userId: string;
  planId: string;
}

export interface AdminUserCreditGrantInput {
  userId: string;
  amount: number;
  note: string;
  idempotencyKey: string;
}

export type AdminUserStatusFilter = 'active' | 'disabled' | 'all';
