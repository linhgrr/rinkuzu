import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PayOSService from '@/services/payment/PayOSService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payosService = new PayOSService();

    // Test the connection
    const isConnected = await payosService.testConnection();

    if (!isConnected) {
      return NextResponse.json({ error: 'PayOS service connection failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'PayOS service is working correctly',
      environment: {
        clientId: !!process.env.PAYOS_CLIENT_ID,
        apiKey: !!process.env.PAYOS_API_KEY,
        checksumKey: !!process.env.PAYOS_CHECKSUM_KEY,
        baseUrl: 'https://api-merchant.payos.vn',
      },
    });
  } catch (error) {
    console.error('PayOS test error:', error);
    return NextResponse.json(
      {
        error: 'PayOS test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
