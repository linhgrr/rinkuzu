const EXPECTED_ORIGIN = 'https://www.rinkuzu.app';
const EXPECTED_PATH = '/api/internal/communications/worker';
const REQUEST_TIMEOUT_MS = 25_000;

export interface SchedulerEnvironment {
  CRON_SECRET?: string;
  TARGET_URL?: string;
}

export interface SchedulerController {
  scheduledTime: number;
}

type SchedulerFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function communicationTarget(rawTarget: string | undefined): URL {
  if (!rawTarget) throw new Error('TARGET_URL is required');

  const target = new URL(rawTarget);
  if (
    target.origin !== EXPECTED_ORIGIN ||
    target.pathname !== EXPECTED_PATH ||
    target.search ||
    target.hash
  ) {
    throw new Error('TARGET_URL must be the Rinkuzu production communications worker');
  }

  return target;
}

export async function invokeCommunicationWorker(
  environment: SchedulerEnvironment,
  scheduledTime: number,
  fetcher: SchedulerFetch = fetch,
): Promise<void> {
  const secret = environment.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('CRON_SECRET is missing or invalid');

  const target = communicationTarget(environment.TARGET_URL);
  const response = await fetcher(target, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'user-agent': 'rinkuzu-cloudflare-scheduler/1.0',
      'x-request-id': `cloudflare-cron-${scheduledTime}`,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Communications worker returned HTTP ${response.status}`);
  }
}

const scheduler = {
  async scheduled(
    controller: SchedulerController,
    environment: SchedulerEnvironment,
  ): Promise<void> {
    try {
      await invokeCommunicationWorker(environment, controller.scheduledTime);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'communications_scheduler_failed',
          scheduledTime: controller.scheduledTime,
          error: error instanceof Error ? error.message : 'Unknown scheduler error',
        }),
      );
      throw error;
    }
  },
};

export default scheduler;
