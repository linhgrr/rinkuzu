import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { unstable_noStore as noStore } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { getDashboardBootstrapData } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  noStore();

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const bootstrapData = await getDashboardBootstrapData(userId, userRole);

    return NextResponse.json({
      success: true,
      data: bootstrapData,
    });
  } catch (error) {
    console.error('Error fetching dashboard bootstrap data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
