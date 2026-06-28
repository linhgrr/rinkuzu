import 'server-only';

import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import type { UserProfileData } from './profile-types';

export async function getUserProfileByEmail(email: string): Promise<UserProfileData | null> {
  await connectDB();

  const user = await User.findOne({ email }).select(
    'email displayName bio avatar role createdAt subscription',
  );

  if (!user) {
    return null;
  }

  return {
    email: user.email,
    displayName: user.displayName || '',
    bio: user.bio || '',
    avatar: user.avatar || '',
    role: user.role,
    createdAt:
      user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
    subscription: user.subscription
      ? {
          type: user.subscription.type,
          isActive: user.subscription.isActive,
          endDate: user.subscription.endDate ? user.subscription.endDate.toISOString() : undefined,
        }
      : undefined,
  };
}
