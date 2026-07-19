import type { AccountDisableState } from '@/shared/constants/account-disable';

export interface UserSubscriptionSnapshot {
  type: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  /** Canonical soft-disable flag: 0 active, 1 disabled. Never hard-delete. */
  disable: AccountDisableState;
  disabledAt?: Date | null;
  disabledBy?: string | null;
  subscription?: UserSubscriptionSnapshot;
  createdAt: Date;
}

/** Public profile user — stable non-PII fields only (no email). */
export type PublicProfileUser = Pick<
  User,
  'id' | 'name' | 'displayName' | 'bio' | 'avatar' | 'createdAt'
>;
