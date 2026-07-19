import crypto from 'crypto';
import {
  IPayOSService,
  PayOSPaymentSignatureData,
  PayOSPaymentRequest,
  PayOSPaymentResponse,
  PayOSVerifyResponse,
} from '@/interfaces/services/IPayOSService';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  payosCreatePaymentResponseSchema,
  payosErrorEnvelopeSchema,
  payosPaymentLinkResponseSchema,
} from '@/lib/integrations/payos';
import type { ZodType } from 'zod';

const PAYOS_REQUEST_TIMEOUT_MS = 15_000;

export class PayOSService implements IPayOSService {
  private clientId: string;
  private apiKey: string;
  private checksumKey: string;
  private baseUrl: string;

  constructor() {
    this.clientId = env.PAYOS_CLIENT_ID;
    this.apiKey = env.PAYOS_API_KEY;
    this.checksumKey = env.PAYOS_CHECKSUM_KEY;
    this.baseUrl = 'https://api-merchant.payos.vn';
  }

  private generateSignature(data: string): string {
    return crypto.createHmac('sha256', this.checksumKey).update(data).digest('hex');
  }

  private generatePaymentSignature(data: PayOSPaymentSignatureData): string {
    // PayOS requires the data string in alphabetical order of the keys
    const rawSignature = `amount=${data.amount}&cancelUrl=${data.cancelUrl}&description=${data.description}&orderCode=${data.orderCode}&returnUrl=${data.returnUrl}`;
    return this.generateSignature(rawSignature);
  }

  private async makeRequest<T>(
    endpoint: string,
    responseSchema: ZodType<T>,
    method: 'GET' | 'POST' = 'POST',
    body?: PayOSPaymentRequest | Record<string, unknown> | null,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client-id': this.clientId,
      'x-api-key': this.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    try {
      logger.debug({ endpoint, method }, 'PayOS API request');

      const response = await fetch(url, {
        // EXTERNAL: PayOS
        ...options,
        signal: AbortSignal.timeout(PAYOS_REQUEST_TIMEOUT_MS),
      });
      const responseText = await response.text();

      logger.debug(
        {
          endpoint,
          status: response.status,
        },
        'PayOS API response',
      );

      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch (_parseError) {
        logger.error({ endpoint, status: response.status }, 'Failed to parse PayOS response body');
        throw new Error('Invalid response from PayOS API');
      }

      if (!response.ok) {
        const errorEnvelope = payosErrorEnvelopeSchema.safeParse(data);
        logger.error(
          {
            endpoint,
            status: response.status,
            code: errorEnvelope.success ? errorEnvelope.data.code : undefined,
            description: errorEnvelope.success ? errorEnvelope.data.desc : undefined,
          },
          'PayOS API error',
        );
        throw new Error(
          `PayOS API error: ${errorEnvelope.success ? errorEnvelope.data.desc : response.statusText}`,
        );
      }

      const parsedResponse = responseSchema.safeParse(data);
      if (!parsedResponse.success) {
        logger.error(
          {
            endpoint,
            status: response.status,
            issues: parsedResponse.error.issues,
          },
          'PayOS API response violated its contract',
        );
        throw new Error('Invalid response from PayOS API');
      }

      return parsedResponse.data;
    } catch (error) {
      logger.error({ error }, 'PayOS API request failed');
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new Error('Payment service is temporarily unavailable');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Payment service is temporarily unavailable');
    }
  }

  async createPayment(
    orderCode: number,
    amount: number,
    description: string,
    returnUrl: string,
    cancelUrl: string,
    buyerEmail?: string,
    buyerName?: string,
  ): Promise<PayOSPaymentResponse> {
    const paymentData = {
      orderCode,
      amount,
      description,
      cancelUrl,
      returnUrl,
      ...(buyerEmail !== undefined && { buyerEmail }),
      ...(buyerName !== undefined && { buyerName }),
    };

    // Generate signature according to PayOS rule
    const signature = this.generatePaymentSignature({
      amount,
      cancelUrl,
      description,
      orderCode,
      returnUrl,
    });

    const requestBody: PayOSPaymentRequest = {
      ...paymentData,
      signature,
    };

    return this.makeRequest<PayOSPaymentResponse>(
      '/v2/payment-requests',
      payosCreatePaymentResponseSchema,
      'POST',
      requestBody,
    );
  }

  async verifyPayment(orderCode: number): Promise<PayOSVerifyResponse> {
    return this.makeRequest<PayOSVerifyResponse>(
      `/v2/payment-requests/${orderCode}`,
      payosPaymentLinkResponseSchema,
      'GET',
    );
  }

  async getPaymentInfo(orderCode: number): Promise<PayOSVerifyResponse> {
    return this.makeRequest<PayOSVerifyResponse>(
      `/v2/payment-requests/${orderCode}`,
      payosPaymentLinkResponseSchema,
      'GET',
    );
  }
}
