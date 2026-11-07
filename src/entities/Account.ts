export interface AccountSubscription {
  planId: string;
  planName: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export interface AccountProfile {
  id: string;
  email: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  createdAt: Date;
  subscription?: AccountSubscription;
  /** false for accounts that only sign in with Google (no password hash). */
  hasPassword?: boolean;
}

export interface AccountCredentials {
  id: string;
  passwordHash?: string;
}
