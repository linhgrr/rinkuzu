import type { AccountProfile } from '@/entities/Account';
import type { AccountProfileDto, AccountSubscriptionDto, AvatarResponseDto } from '@/dtos/account';

function toSubscriptionDto(profile: AccountProfile): AccountSubscriptionDto | undefined {
  if (!profile.subscription) return undefined;
  return {
    type: profile.subscription.type,
    startDate: profile.subscription.startDate?.toISOString(),
    endDate: profile.subscription.endDate?.toISOString(),
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
      createdAt: profile.createdAt.toISOString(),
      subscription: toSubscriptionDto(profile),
    };
  }

  static toAvatarResponse(avatar: string): AvatarResponseDto {
    return { avatar };
  }
}
