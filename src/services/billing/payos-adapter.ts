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
  /**
   * Null when the response carried no parsable envelope — an empty 404 body, or
   * an HTML error page from a gateway in front of the provider. Callers must
   * branch on `status` first and treat a missing envelope as no information.
   */
  body: z.infer<typeof envelopeSchema> | null;
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

function parseEnvelope(raw: string): z.infer<typeof envelopeSchema> | null {
  if (raw.trim() === '') return null;
  try {
    const parsed = envelopeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Provider-supplied reason, or the bare status when it sent none. */
function describeResponse(response: PayOSResponse): string {
  return response.body?.desc?.trim() || `PayOS responded with HTTP ${response.status}`;
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
  // Read as text and parse defensively: consuming JSON before checking status
  // turned an empty 404 or an HTML gateway error into a parse failure, which
  // masked the status the caller actually needed. `getPayment` in particular
  // must be able to see a 404 to report "no such payment".
  const raw = await response.text();
  return { status: response.status, body: parseEnvelope(raw) };
}

function paymentSignature(input: PaymentSignatureInput): string {
  const { checksumKey } = credentials();
  const data = `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`;
  return crypto.createHmac('sha256', checksumKey).update(data).digest('hex');
}

/**
 * The provider surface the billing repository actually depends on. Narrowing it
 * to an interface keeps the repository testable without casting a stub to the
 * concrete HTTP adapter.
 */
export interface BillingPaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<ProviderCreateOutcome>;
  getPayment(orderCode: number): Promise<ProviderPaymentSnapshot | null>;
  cancelPayment(orderCode: number, reason: string): Promise<ProviderPaymentSnapshot>;
}

export class BillingPayOSAdapter implements BillingPaymentProvider {
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
        return { kind: 'definite_failure', message: describeResponse(response) };
      }
      if (response.status === 429 || response.status >= 500) {
        return { kind: 'indeterminate', message: describeResponse(response) };
      }
      if (response.status !== 200) {
        return { kind: 'indeterminate', message: describeResponse(response) };
      }
      if (response.body === null) {
        // A 200 we cannot read says nothing about whether a link was created.
        return { kind: 'indeterminate', message: describeResponse(response) };
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
        return { kind: 'indeterminate', message: describeResponse(response) };
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
    // Checked before the body: an empty 404 must still read as "no payment".
    if (response.status === 404) return null;
    if (response.status !== 200 || response.body?.code !== '00' || !response.body.data) {
      throw new Error(describeResponse(response));
    }
    return paymentDataSchema.parse(response.body.data);
  }

  async cancelPayment(orderCode: number, reason: string): Promise<ProviderPaymentSnapshot> {
    const response = await request(`/v2/payment-requests/${orderCode}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellationReason: reason }),
    });
    if (response.status !== 200 || response.body?.code !== '00' || !response.body.data) {
      throw new Error(describeResponse(response));
    }
    return paymentDataSchema.parse(response.body.data);
  }
}
