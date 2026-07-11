import { Link } from '@/i18n/navigation';
import { UserAvatar } from './UserAvatar';
import { type UserIdentity, getUserDisplayName } from './user-identity';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';

interface UserProfileLinkProps {
  user: UserIdentity;
  avatarSize?: number;
  className?: string;
  nameClassName?: string;
}

export function UserProfileLink({
  user,
  avatarSize = 32,
  className,
  nameClassName,
}: UserProfileLinkProps) {
  const content = (
    <>
      <UserAvatar user={user} size={avatarSize} />
      <span className={cn('truncate', nameClassName)}>{getUserDisplayName(user)}</span>
    </>
  );

  if (!user.id) {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>{content}</span>
    );
  }

  return (
    <Link
      href={ROUTES.USER.PROFILE(user.id)}
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-full transition hover:text-brand-trust',
        className,
      )}
    >
      {content}
    </Link>
  );
}
