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
  subscription?: UserSubscriptionSnapshot;
  createdAt: Date;
}

export type PublicProfileUser = Pick<
  User,
  'id' | 'email' | 'name' | 'displayName' | 'bio' | 'avatar' | 'createdAt'
>;
