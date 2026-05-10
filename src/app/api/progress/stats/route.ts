import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserProgressStats } from '@/lib/dashboard';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const userId = (session.user as any).id;
    const stats = await getUserProgressStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    return apiErr('internal_error', 'Internal Server Error', 500);
  }
}
