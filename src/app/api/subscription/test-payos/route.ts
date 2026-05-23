import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { PayOSService } from '@/services/payment/PayOSService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  try {
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
    logger.error({ error }, 'PayOS test error');
    return apiErr('internal_error', 'PayOS test failed', 500);
  }
});
