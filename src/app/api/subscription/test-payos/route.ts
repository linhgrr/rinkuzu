import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { PayOSService } from '@/services/payment/PayOSService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const payosService = new PayOSService();

    // Test the connection
    const isConnected = await payosService.testConnection();

    if (!isConnected) {
      return apiErr('service_unavailable', 'PayOS service connection failed', 503);
    }

    return apiOk(
      {
        environment: {
          clientId: !!process.env['PAYOS_CLIENT_ID'],
          apiKey: !!process.env['PAYOS_API_KEY'],
          checksumKey: !!process.env['PAYOS_CHECKSUM_KEY'],
          baseUrl: 'https://api-merchant.payos.vn',
        },
      },
      200,
      { meta: { message: 'PayOS service is working correctly' } },
    );
  } catch (error) {
    console.error('PayOS test error:', error);
    return apiErr('internal_error', 'PayOS test failed', 500);
  }
}
