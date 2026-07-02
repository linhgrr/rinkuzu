export type AdminUserRoleViewModel = 'admin' | 'user';

export interface AdminUserSubscriptionViewModel {
  type: string;
  startDate?: string;
  startDateLabel?: string;
  endDate?: string;
  endDateLabel?: string;
  isActive: boolean;
  statusLabel: 'noSubscription' | 'inactive' | 'lifetime' | 'active';
  statusVariant: 'default' | 'danger' | 'warning' | 'success';
}

export interface AdminUserViewModel {
  id: string;
  email: string;
  displayName?: string;
  role: AdminUserRoleViewModel;
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
