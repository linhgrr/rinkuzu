import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Plan from '@/models/Plan';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

const userService = serviceFactory.getUserService();
const adminService = serviceFactory.getAdminService();

// GET /api/admin/users - List users with filtering
export const GET = withAdmin(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';

    const result = await userService.getAllUsers({
      page,
      limit,
      search,
    });

    return apiOk(result);
  } catch (error: any) {
    console.error('Get users error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// PUT /api/admin/users - Update user role
export const PUT = withAdmin(async (request: NextRequest, context) => {
  try {
    const adminEmail = context.email;
    if (!adminEmail) {
      return apiErr('validation_error', 'Admin email is required', 400);
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return apiErr('validation_error', 'User ID and role are required', 400);
    }

    const result = await adminService.updateUserRole(userId, role, adminEmail);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(result.data);
  } catch (error: any) {
    console.error('Update user role error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// DELETE /api/admin/users - Delete user
export const DELETE = withAdmin(async (request: NextRequest, context) => {
  try {
    const adminEmail = context.email;
    if (!adminEmail) {
      return apiErr('validation_error', 'Admin email is required', 400);
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return apiErr('validation_error', 'User ID is required', 400);
    }

    const result = await adminService.deleteUser(userId, adminEmail);

    if (!result.success) {
      return apiServiceErr(result, 400);
    }

    return apiOk(null, 200, { meta: { message: 'User deleted successfully' } });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// POST /api/admin/users - Add subscription to user
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const { userId, planId, duration } = await request.json();

    if (!userId || !planId) {
      return apiErr('validation_error', 'User ID and Plan ID are required', 400);
    }

    await connectDB();

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return apiErr('not_found', 'User not found', 404);
    }

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return apiErr('not_found', 'Plan not found', 404);
    }

    // Calculate subscription dates
    const startDate = new Date();
    let endDate: Date | undefined;

    if (plan.name === 'lifetime') {
      // Lifetime subscription - no end date
      endDate = undefined;
    } else {
      // Time-limited subscription
      const durationInDays = duration || 180; // Default to 6 months if not specified
      endDate = new Date(startDate.getTime() + durationInDays * 24 * 60 * 60 * 1000);
    }

    // Update user subscription
    await User.findByIdAndUpdate(userId, {
      subscription: {
        type: planId,
        startDate,
        endDate,
        isActive: true,
        payosOrderId: `admin_${Date.now()}`,
        payosTransactionId: `admin_${Date.now()}`,
      },
    });

    // Create subscription record
    const Subscription = (await import('@/models/Subscription')).default;
    const subscription = new Subscription({
      user: userId,
      userEmail: user.email,
      type: planId,
      amount: plan.price,
      currency: 'VND',
      status: 'completed',
      payosOrderId: `admin_${Date.now()}`,
      payosTransactionId: `admin_${Date.now()}`,
      startDate,
      endDate,
      isActive: true,
    });

    await subscription.save();

    return apiOk(
      {
        user: user.email,
        plan: plan.name,
        startDate,
        endDate,
        isActive: true,
      },
      200,
      { meta: { message: 'Subscription added successfully' } },
    );
  } catch (error: any) {
    console.error('Add subscription error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
