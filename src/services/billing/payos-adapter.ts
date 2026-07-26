import crypto from 'crypto';
import { z } from 'zod';
import { assertTrustedPayosCheckoutUrl } from '@/lib/security/trusted-navigation';

const API_BASE = 'https://api-merchant.payos.vn';
const TIMEOUT_MS = 15_000;

const envelopeSchema = z.object({
  code: z.string(),
  desc: z.string(),
  data: z.unknown().nullish(),
});

const createDataSchema = z.object({
  orderCode: z.number().int().safe(),
  amount: z.number().int().nonnegative(),
  currency: z.string(),
  paymentLinkId: z.string().min(1),
  checkoutUrl: z.url(),
  qrCode: z.string().optional(),
  status: z.string(),
});

const transactionSchema = z.object({
  reference: z.string().min(1),
  amount: z.number().int().nonnegative(),
  transactionDateTime: z.string(),
  counterAccountBankId: z.string().nullish(),
  counterAccountNumber: z.string().nullish(),
});

const paymentDataSchema = z.object({
  id: z.string(),
  orderCode: z.number().int().safe(),
  amount: z.number().int().nonnegative(),
  amountPaid: z.number().int().nonnegative(),
  amountRemaining: z.number().int().nonnegative(),
  currency: z.string().optional(),
  status: z.string(),
  createdAt: z.string(),
  transactions: z.unknown().transform((value) => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      const parsed = transactionSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }),
});

export type ProviderCreateOutcome =
  | {
      kind: 'created';
      paymentLinkId: string;
      checkoutUrl: string;
      qrCode?: string;
    }
  | { kind: 'duplicate' }
  | { kind: 'definite_failure'; message: string }
  | { kind: 'indeterminate'; message: string };

export type ProviderPaymentSnapshot = z.infer<typeof paymentDataSchema>;

interface PayOSCredentials {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

interface PayOSResponse {
  status: number;
  body: z.infer<typeof envelopeSchema>;
}

interface PaymentSignatureInput {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}

export interface CreateCheckoutInput extends PaymentSignatureInput {
  expiredAt: number;
  buyerEmail: string;
}

function credentials(): PayOSCredentials {
  const clientId = process.env['PAYOS_CLIENT_ID'];
  const apiKey = process.env['PAYOS_API_KEY'];
  const checksumKey = process.env['PAYOS_CHECKSUM_KEY'];
  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('PayOS credentials are not configured');
  }
  return { clientId, apiKey, checksumKey };
}

async function request(endpoint: string, init: RequestInit): Promise<PayOSResponse> {
  const { clientId, apiKey } = credentials();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-key': apiKey,
      ...init.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json: unknown = await response.json();
  return { status: response.status, body: envelopeSchema.parse(json) };
}

function paymentSignature(input: PaymentSignatureInput): string {
  const { checksumKey } = credentials();
  const data = `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`;
  return crypto.createHmac('sha256', checksumKey).update(data).digest('hex');
}

export class BillingPayOSAdapter {
  async createCheckout(input: CreateCheckoutInput): Promise<ProviderCreateOutcome> {
    const body = {
      ...input,
      signature: paymentSignature(input),
    };
    try {
      const response = await request('/v2/payment-requests', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (response.status === 401 || response.status === 400) {
        return { kind: 'definite_failure', message: response.body.desc };
      }
      if (response.status === 429 || response.status >= 500) {
        return { kind: 'indeterminate', message: response.body.desc };
      }
      if (response.status !== 200) {
        return { kind: 'indeterminate', message: response.body.desc };
      }
      if (response.body.code !== '00') {
        try {
          const snapshot = await this.getPayment(input.orderCode);
          if (snapshot) {
            return {
              kind: 'created',
              paymentLinkId: snapshot.id,
              checkoutUrl: `https://pay.payos.vn/web/${snapshot.id}`,
            };
          }
        } catch {
          // Keep this indeterminate when the provider state cannot be queried.
        }
        if (/tồn tại|đã tồn tại|exist/i.test(response.body.desc)) {
          return { kind: 'duplicate' };
        }
        return { kind: 'indeterminate', message: response.body.desc };
      }
      const data = createDataSchema.parse(response.body.data);
      return {
        kind: 'created',
        paymentLinkId: data.paymentLinkId,
        checkoutUrl: assertTrustedPayosCheckoutUrl(data.checkoutUrl),
        ...(data.qrCode ? { qrCode: data.qrCode } : {}),
      };
    } catch (error) {
      return {
        kind: 'indeterminate',
        message: error instanceof Error ? error.message : 'PayOS request failed',
      };
    }
  }

  async getPayment(orderCode: number): Promise<ProviderPaymentSnapshot | null> {
    const response = await request(`/v2/payment-requests/${orderCode}`, { method: 'GET' });
    if (response.status === 404) return null;
    if (response.status !== 200 || response.body.code !== '00' || !response.body.data) {
      throw new Error(response.body.desc || 'Could not retrieve PayOS payment');
    }
    return paymentDataSchema.parse(response.body.data);
  }

  async cancelPayment(orderCode: number, reason: string): Promise<ProviderPaymentSnapshot> {
    const response = await request(`/v2/payment-requests/${orderCode}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellationReason: reason }),
    });
    if (response.status !== 200 || response.body.code !== '00' || !response.body.data) {
      throw new Error(response.body.desc || 'Could not cancel PayOS payment');
    }
    return paymentDataSchema.parse(response.body.data);
  }
}
