import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    
    // Check if user is authenticated or has userEmail
    if (!session?.user?.email && !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Authentication required or userEmail parameter' },
        { status: 401 }
      );
    }

    const userService = serviceFactory.getUserService();
    
    // Use session email if available, otherwise use userEmail from params
    const email = session?.user?.email || userEmail!;
    const result = await userService.getAttemptDetails(params.id, email);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error: any) {
    console.error('Get attempt details error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 