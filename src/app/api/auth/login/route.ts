import { NextRequest, NextResponse } from 'next/server';
import { serviceFactory } from '@/lib/serviceFactory';

const authService = serviceFactory.getAuthService();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const result = await authService.login({ email, password });

    return NextResponse.json(
      {
        success: true,
        data: result
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.message === 'Email and password are required') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    if (error.message === 'Invalid credentials') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 