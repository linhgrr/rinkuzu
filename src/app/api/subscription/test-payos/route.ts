import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PayOSService from '@/services/payment/PayOSService';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const payosService = new PayOSService();

    // Test the connection
    const isConnected = await payosService.testConnection();

    if (!isConnected) {
      return apiErr('service_error', 'PayOS service connection failed', 500);
    }

    return NextResponse.json({
      success: true,
      message: 'PayOS service is working correctly',
      environment: {
        clientId: !!process.env['PAYOS_CLIENT_ID'],
        apiKey: !!process.env['PAYOS_API_KEY'],
        checksumKey: !!process.env['PAYOS_CHECKSUM_KEY'],
        baseUrl: 'https://api-merchant.payos.vn',
      },
    });
  } catch (error) {
    console.error('PayOS test error:', error);
    return apiErr('internal_error', 'PayOS test failed', 500);
  }
}
