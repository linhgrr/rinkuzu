import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import Quiz from '@/models/Quiz';

const userService = serviceFactory.getUserService();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('Session:', session?.user?.email);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get pagination parameters from URL
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    console.log('Fetching attempts for user:', session.user.email, 'page:', page, 'limit:', limit);

    const result = await userService.getUserAttempts(session.user.email, { page, limit });

    console.log('Result from service:', result);

    return NextResponse.json({
      success: true,
      data: result.attempts,
      pagination: result.pagination,
    });

  } catch (error: any) {
    console.error('Get user attempts error:', error);
    
    if (error.message === 'User not found') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 