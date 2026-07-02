import type { AccountProfileDto } from '@/dtos/account';
import type { ProfileSettingsViewModel } from '@/features/profile/types/profile-settings-view-model';
import { formatDate } from '@/lib/formatters';

export function toProfileSettingsViewModel(profile: AccountProfileDto): ProfileSettingsViewModel {
  return {
    email: profile.email,
    displayName: profile.displayName,
    bio: profile.bio,
    avatar: profile.avatar,
    role: profile.role,
    createdAt: profile.createdAt,
    createdAtLabel: formatDate(profile.createdAt),
    subscription: profile.subscription
      ? {
          type: profile.subscription.type,
          startDate: profile.subscription.startDate,
          endDate: profile.subscription.endDate,
          isActive: profile.subscription.isActive,
          payosOrderId: profile.subscription.payosOrderId,
          payosTransactionId: profile.subscription.payosTransactionId,
        }
      : undefined,
  };
}
