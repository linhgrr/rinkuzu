export interface AccountSubscription {
  type: string;
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
}

export interface AccountCredentials {
  id: string;
  passwordHash?: string;
}
