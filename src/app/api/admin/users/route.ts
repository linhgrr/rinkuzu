import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import Plan from '@/models/Plan';

const userService = serviceFactory.getUserService();
const adminService = serviceFactory.getAdminService();

// GET /api/admin/users - List users with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';

    const result = await userService.getAllUsers({
      page,
      limit,
      search
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users - Update user role
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    const result = await adminService.updateUserRole(userId, role, session.user.email!);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error('Update user role error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const result = await adminService.deleteUser(userId, session.user.email!);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Add subscription to user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId, planId, duration } = await request.json();

    if (!userId || !planId) {
      return NextResponse.json(
        { success: false, error: 'User ID and Plan ID are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
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
      }
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

    return NextResponse.json({
      success: true,
      message: 'Subscription added successfully',
      data: {
        user: user.email,
        plan: plan.name,
        startDate,
        endDate,
        isActive: true
      }
    });

  } catch (error: any) {
    console.error('Add subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 