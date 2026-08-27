const EXPECTED_ORIGIN = 'https://www.rinkuzu.app';
const REQUEST_TIMEOUT_MS = 55_000;

/**
 * Both drains run on every tick. Inbox first so freshly verified webhooks turn
 * into entitlements as early as possible; reconciliation then catches whatever
 * the provider never delivered a webhook for.
 */
const BILLING_PATHS = ['/api/internal/billing/process', '/api/internal/billing/reconcile'] as const;

export interface SchedulerEnvironment {
  BILLING_INTERNAL_HMAC_SECRET?: string;
  TARGET_ORIGIN?: string;
}

export interface SchedulerController {
  scheduledTime: number;
}

type SchedulerFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function billingOrigin(rawOrigin: string | undefined): string {
  if (!rawOrigin) throw new Error('TARGET_ORIGIN is required');

  const target = new URL(rawOrigin);
  if (
    target.origin !== EXPECTED_ORIGIN ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new Error('TARGET_ORIGIN must be the Rinkuzu production origin');
  }

  return target.origin;
}

async function signature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function invokeBillingPath(
  origin: string,
  secret: string,
  path: string,
  scheduledTime: number,
  fetcher: SchedulerFetch,
): Promise<void> {
  // The application verifies HMAC over method, path, timestamp and nonce, and
  // rejects a replayed nonce, so each invocation must be freshly signed.
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const signed = await signature(secret, `POST\n${path}\n${timestamp}\n${nonce}`);

  const response = await fetcher(`${origin}${path}`, {
    method: 'POST',
    headers: {
      'x-rinkuzu-timestamp': timestamp,
      'x-rinkuzu-nonce': nonce,
      'x-rinkuzu-signature': signed,
      'user-agent': 'rinkuzu-cloudflare-billing-scheduler/1.0',
      'x-request-id': `cloudflare-billing-cron-${scheduledTime}`,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Billing worker ${path} returned HTTP ${response.status}`);
  }
}

export async function invokeBillingWorker(
  environment: SchedulerEnvironment,
  scheduledTime: number,
  fetcher: SchedulerFetch = fetch,
): Promise<void> {
  const secret = environment.BILLING_INTERNAL_HMAC_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('BILLING_INTERNAL_HMAC_SECRET is missing or invalid');
  }

  const origin = billingOrigin(environment.TARGET_ORIGIN);

  // A failing inbox drain must not stop reconciliation: reconciliation is the
  // safety net that repairs orders the inbox could not settle.
  const failures: string[] = [];
  for (const path of BILLING_PATHS) {
    try {
      await invokeBillingPath(origin, secret, path, scheduledTime, fetcher);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${path} failed`);
    }
  }
  if (failures.length > 0) throw new Error(failures.join('; '));
}

const scheduler = {
  async scheduled(
    controller: SchedulerController,
    environment: SchedulerEnvironment,
  ): Promise<void> {
    try {
      await invokeBillingWorker(environment, controller.scheduledTime);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'billing_scheduler_failed',
          scheduledTime: controller.scheduledTime,
          error: error instanceof Error ? error.message : 'Unknown scheduler error',
        }),
      );
      throw error;
    }
  },
};

export default scheduler;
