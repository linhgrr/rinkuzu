import type { AccountProfile } from '@/entities/Account';
import type {
  AccountProfileDto,
  AccountSubscriptionDto,
  AvatarDeleteResultDto,
  AvatarResponseDto,
  PasswordChangeResultDto,
} from '@/dtos/account';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function toSubscriptionDto(profile: AccountProfile): AccountSubscriptionDto | undefined {
  if (!profile.subscription) return undefined;
  const startDate = serializeOptionalDate(
    profile.subscription.startDate,
    'profile.subscription.startDate',
  );
  const endDate = serializeOptionalDate(
    profile.subscription.endDate,
    'profile.subscription.endDate',
  );
  return {
    type: profile.subscription.type,
    isActive: profile.subscription.isActive,
    ...(startDate === undefined ? {} : { startDate }),
    ...(endDate === undefined ? {} : { endDate }),
    ...(profile.subscription.payosOrderId === undefined
      ? {}
      : { payosOrderId: profile.subscription.payosOrderId }),
    ...(profile.subscription.payosTransactionId === undefined
      ? {}
      : { payosTransactionId: profile.subscription.payosTransactionId }),
  };
}

export class AccountDtoMapper {
  static toProfile(profile: AccountProfile): AccountProfileDto {
    const subscription = toSubscriptionDto(profile);
    return {
      email: profile.email,
      role: profile.role,
      createdAt: serializeDate(profile.createdAt, 'profile.createdAt'),
      ...(profile.displayName === undefined ? {} : { displayName: profile.displayName }),
      ...(profile.bio === undefined ? {} : { bio: profile.bio }),
      ...(profile.avatar === undefined ? {} : { avatar: profile.avatar }),
      ...(subscription === undefined ? {} : { subscription }),
    };
  }

  static toAvatarResponse(avatar: string): AvatarResponseDto {
    return { avatar };
  }

  static toPasswordChangeResult(email: string): PasswordChangeResultDto {
    return { email, passwordChanged: true };
  }

  static toAvatarDeleteResult(email: string): AvatarDeleteResultDto {
    return { email, avatar: null, deleted: true };
  }
}
