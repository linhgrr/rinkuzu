export interface ProfileSettingsSubscriptionViewModel {
  type: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  payosOrderId?: string;
  payosTransactionId?: string;
}

export interface ProfileSettingsViewModel {
  email: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  role: 'admin' | 'user';
  createdAt: string;
  createdAtLabel: string;
  subscription?: ProfileSettingsSubscriptionViewModel;
}

export interface UpdateProfileSettingsInput {
  displayName?: string;
  bio?: string;
}

export interface ChangeProfilePasswordInput {
  currentPassword: string;
  newPassword: string;
}
