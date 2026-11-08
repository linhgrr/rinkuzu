interface ProfileSettingsSubscriptionViewModel {
  plan: {
    id: string;
    name: string;
  };
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
  /** false: Google-only account, the security tab shows no password form. */
  hasPassword?: boolean;
}

export interface UpdateProfileSettingsInput {
  displayName?: string;
  bio?: string;
}

export interface ChangeProfilePasswordInput {
  currentPassword: string;
  newPassword: string;
}
