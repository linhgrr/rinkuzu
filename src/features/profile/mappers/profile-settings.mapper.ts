import type { AccountProfileDto } from '@/dtos/account';
import type { ProfileSettingsViewModel } from '@/features/profile/types/profile-settings-view-model';
import { formatCalendarDate } from '@/lib/formatters';

export function toProfileSettingsViewModel(
  profile: AccountProfileDto,
  locale: string,
): ProfileSettingsViewModel {
  const subscription = profile.subscription
    ? {
        plan: profile.subscription.plan,
        ...(profile.subscription.startDate !== undefined && {
          startDate: profile.subscription.startDate,
        }),
        ...(profile.subscription.endDate !== undefined && {
          endDate: profile.subscription.endDate,
        }),
        isActive: profile.subscription.isActive,
        ...(profile.subscription.payosOrderId !== undefined && {
          payosOrderId: profile.subscription.payosOrderId,
        }),
        ...(profile.subscription.payosTransactionId !== undefined && {
          payosTransactionId: profile.subscription.payosTransactionId,
        }),
      }
    : undefined;

  return {
    email: profile.email,
    ...(profile.displayName !== undefined && { displayName: profile.displayName }),
    ...(profile.bio !== undefined && { bio: profile.bio }),
    ...(profile.avatar !== undefined && { avatar: profile.avatar }),
    role: profile.role,
    createdAt: profile.createdAt,
    createdAtLabel: formatCalendarDate(profile.createdAt, locale),
    ...(subscription !== undefined && { subscription }),
    ...(profile.hasPassword !== undefined && { hasPassword: profile.hasPassword }),
  };
}
