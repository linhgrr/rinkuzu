import type { AccountProfile } from '@/entities/Account';
import type { AccountProfileDto, AccountSubscriptionDto, AvatarResponseDto } from '@/dtos/account';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function toSubscriptionDto(profile: AccountProfile): AccountSubscriptionDto | undefined {
  if (!profile.subscription) return undefined;
  return {
    type: profile.subscription.type,
    startDate: serializeOptionalDate(
      profile.subscription.startDate,
      'profile.subscription.startDate',
    ),
    endDate: serializeOptionalDate(profile.subscription.endDate, 'profile.subscription.endDate'),
    isActive: profile.subscription.isActive,
    payosOrderId: profile.subscription.payosOrderId,
    payosTransactionId: profile.subscription.payosTransactionId,
  };
}

export class AccountDtoMapper {
  static toProfile(profile: AccountProfile): AccountProfileDto {
    return {
      email: profile.email,
      displayName: profile.displayName,
      bio: profile.bio,
      avatar: profile.avatar,
      role: profile.role,
      createdAt: serializeDate(profile.createdAt, 'profile.createdAt'),
      subscription: toSubscriptionDto(profile),
    };
  }

  static toAvatarResponse(avatar: string): AvatarResponseDto {
    return { avatar };
  }
}
