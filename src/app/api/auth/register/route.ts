import { NextRequest, NextResponse } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';

const authService = serviceFactory.getAuthService();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const role = 'user'; // Always default to user

    const result = await authService.register({ email, password, role });

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully',
        data: {
          id: result.user._id,
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message === 'Email and password are required' ||
      message === 'Invalid email format' ||
      message === 'Password must be between 8 and 72 characters'
    ) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    if (message === 'User with this email already exists') {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
