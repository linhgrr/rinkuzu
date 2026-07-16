import { createAdaptiveJobActionRoute } from '../job-action-route';

export const dynamic = 'force-dynamic';

export const POST = createAdaptiveJobActionRoute({ action: 'retry', timeoutMs: 30_000 });
