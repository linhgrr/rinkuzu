import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { hashPassword, verifyPassword } from '@/lib/password';
import { apiErr } from '@/lib/api/response';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return apiErr('unauthorized', 'Authentication required', 401);
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return apiErr('validation_error', 'Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      return apiErr('validation_error', 'New password must be at least 6 characters', 400);
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email }).select('password isAnonymous');

    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    if (user.isAnonymous || !user.password) {
      return apiErr('validation_error', 'Password change is not available for this account', 400);
    }

    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      return apiErr('validation_error', 'Current password is incorrect', 400);
    }

    const hashedPassword = await hashPassword(newPassword);
    await User.updateOne({ email: session.user.email }, { password: hashedPassword });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}
