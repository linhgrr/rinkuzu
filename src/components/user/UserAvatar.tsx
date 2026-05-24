import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getUserDisplayName, type UserIdentity } from './user-identity';

function getUserInitial(user: UserIdentity): string {
  return getUserDisplayName(user).charAt(0).toUpperCase();
}

interface UserAvatarProps {
  user: UserIdentity;
  size?: number;
  className?: string;
}

export function UserAvatar({ user, size = 40, className }: UserAvatarProps) {
  const initial = getUserInitial(user);
  const style = { width: size, height: size };

  if (user.avatar) {
    return (
      <Image
        src={user.avatar}
        alt={`${getUserDisplayName(user)} avatar`}
        width={size}
        height={size}
        className={cn('rounded-full border border-neutral-200 object-cover', className)}
        style={style}
        unoptimized
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-trust text-white',
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      <span style={{ fontSize: Math.max(12, Math.floor(size * 0.4)) }}>{initial}</span>
    </div>
  );
}
