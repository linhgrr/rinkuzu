import { createAdaptiveJobActionRoute } from '../job-action-route';

export const dynamic = 'force-dynamic';

export const POST = createAdaptiveJobActionRoute({ action: 'cancel', timeoutMs: 25_000 });
