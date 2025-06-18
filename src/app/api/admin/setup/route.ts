import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import { hashPassword } from '@/lib/password';

// POST /api/admin/setup - Create default admin account (only if no admin exists)
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin account already exists' },
        { status: 400 }
      );
    }

    // Check if total users exceed limit (security measure)
    const userCount = await User.countDocuments();
    if (userCount > 10) {
      return NextResponse.json(
        { success: false, error: 'Setup only allowed for new installations' },
        { status: 400 }
      );
    }

    // Create default admin account
    const defaultEmail = 'admin@quizcreator.com';
    const defaultPassword = '***REMOVED***';

    // Check if admin email already exists
    const existingUser = await User.findOne({ email: defaultEmail });
    if (existingUser) {
      // Update existing user to admin role
      existingUser.role = 'admin';
      existingUser.password = await hashPassword(defaultPassword);
      await existingUser.save();

      return NextResponse.json({
        success: true,
        message: 'Existing user upgraded to admin',
        data: {
          email: defaultEmail,
          role: 'admin'
        }
      });
    }

    // Create new admin user
    const hashedPassword = await hashPassword(defaultPassword);
    const adminUser = new User({
      email: defaultEmail,
      password: hashedPassword,
      role: 'admin'
    });

    await adminUser.save();

    return NextResponse.json({
      success: true,
      message: 'Default admin account created successfully',
      data: {
        email: defaultEmail,
        role: 'admin',
        note: 'Please change the default password after first login'
      }
    });

  } catch (error: any) {
    console.error('Admin setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create admin account' },
      { status: 500 }
    );
  }
}

// GET /api/admin/setup - Check if admin setup is needed
export async function GET() {
  try {
    await connectDB();

    const adminExists = await User.findOne({ role: 'admin' });
    const userCount = await User.countDocuments();

    return NextResponse.json({
      success: true,
      data: {
        adminExists: !!adminExists,
        setupAllowed: userCount <= 10 && !adminExists,
        userCount
      }
    });

  } catch (error: any) {
    console.error('Admin setup check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check admin setup status' },
      { status: 500 }
    );
  }
} 